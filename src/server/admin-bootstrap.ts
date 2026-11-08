import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import * as schema from "@/server/db/schema";
import { DEFAULT_STATUSES } from "@/lib/status-colors";

type DB = PostgresJsDatabase<typeof schema>;

export function adminEmails(raw = process.env.ADMIN_EMAILS) {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export type BootstrapResult = {
  promoted: number;
  admin: "created" | "password-updated" | "unchanged" | "skipped";
  reason?: string;
};

/**
 * Keeps admin accounts in line with the env (runs on every server start):
 *  1. every address in ADMIN_EMAILS has role=admin (also accounts that signed up first);
 *  2. if ADMIN_PASSWORD is set, the FIRST address in ADMIN_EMAILS exists with that password:
 *     created if missing, and its password reset whenever ADMIN_PASSWORD changes.
 * No "server-only" import, so scripts and tests can call it with their own db.
 */
export async function ensureAdmins(
  db: DB,
  env: Record<string, string | undefined> = process.env,
): Promise<BootstrapResult> {
  const emails = adminEmails(env.ADMIN_EMAILS);
  if (emails.length === 0)
    return { promoted: 0, admin: "skipped", reason: "ADMIN_EMAILS is empty" };

  const promoted = await db
    .update(schema.user)
    .set({ role: "admin" })
    .where(
      and(inArray(schema.user.email, emails), ne(schema.user.role, "admin")),
    )
    .returning({ id: schema.user.id });

  const password = env.ADMIN_PASSWORD ?? "";
  if (!password)
    return {
      promoted: promoted.length,
      admin: "skipped",
      reason: "ADMIN_PASSWORD is not set",
    };
  if (password.length < 8) {
    return {
      promoted: promoted.length,
      admin: "skipped",
      reason: "ADMIN_PASSWORD must be at least 8 characters",
    };
  }

  const email = emails[0];
  const existing = await db.query.user.findFirst({
    where: eq(schema.user.email, email),
  });

  if (!existing) {
    const id = randomUUID();
    await db.insert(schema.user).values({
      id,
      name: "Admin",
      email,
      emailVerified: true,
      role: "admin",
    });
    await db.insert(schema.account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(password),
    });
    await db
      .insert(schema.statuses)
      .values(
        DEFAULT_STATUSES.map((s, i) => ({ ...s, userId: id, position: i })),
      );
    return { promoted: promoted.length, admin: "created" };
  }

  // Existing account: (re)set its email+password login only when the password differs.
  const cred = await db.query.account.findFirst({
    where: and(
      eq(schema.account.userId, existing.id),
      eq(schema.account.providerId, "credential"),
    ),
  });
  if (
    cred?.password &&
    (await verifyPassword({ hash: cred.password, password }))
  ) {
    return { promoted: promoted.length, admin: "unchanged" };
  }
  const hash = await hashPassword(password);
  if (cred) {
    await db
      .update(schema.account)
      .set({ password: hash })
      .where(eq(schema.account.id, cred.id));
  } else {
    // Admin signed up with Google/GitHub before: add an email+password login too.
    await db.insert(schema.account).values({
      id: randomUUID(),
      accountId: existing.id,
      providerId: "credential",
      userId: existing.id,
      password: hash,
    });
  }
  // A changed password signs the admin out everywhere.
  await db.delete(schema.session).where(eq(schema.session.userId, existing.id));
  await db
    .update(schema.user)
    .set({ emailVerified: true })
    .where(eq(schema.user.id, existing.id));
  return { promoted: promoted.length, admin: "password-updated" };
}
