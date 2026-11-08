import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { verifyPassword } from "better-auth/crypto";
import * as schema from "@/server/db/schema";
import { ensureAdmins } from "./admin-bootstrap";

type DB = PostgresJsDatabase<typeof schema>;
let db: DB;

// A real Postgres (in-memory PGlite) with the app's actual migrations.
beforeAll(async () => {
  const client = new PGlite();
  const d = drizzle(client, { schema, casing: "snake_case" });
  await migrate(d, { migrationsFolder: "./drizzle" });
  db = d as unknown as DB;
}, 60_000);

const ADMIN = "boss@trackr.test";

async function credentialHash(email: string) {
  const u = await db.query.user.findFirst({
    where: eq(schema.user.email, email),
  });
  const acc = await db.query.account.findFirst({
    where: and(
      eq(schema.account.userId, u!.id),
      eq(schema.account.providerId, "credential"),
    ),
  });
  return { user: u!, hash: acc!.password! };
}

describe("ensureAdmins", () => {
  it("does nothing without ADMIN_EMAILS, and doesn't create without a password", async () => {
    expect(await ensureAdmins(db, {})).toMatchObject({ admin: "skipped" });
    expect(await ensureAdmins(db, { ADMIN_EMAILS: ADMIN })).toMatchObject({
      admin: "skipped",
    });
    expect(
      await db.query.user.findFirst({ where: eq(schema.user.email, ADMIN) }),
    ).toBeUndefined();
  });

  it("refuses a password under 8 characters", async () => {
    expect(
      await ensureAdmins(db, { ADMIN_EMAILS: ADMIN, ADMIN_PASSWORD: "short" }),
    ).toMatchObject({
      admin: "skipped",
      reason: expect.stringMatching(/8 characters/),
    });
  });

  it("creates the first listed email as a verified admin with that password and default stages", async () => {
    const r = await ensureAdmins(db, {
      ADMIN_EMAILS: ` ${ADMIN.toUpperCase()} , other@trackr.test`,
      ADMIN_PASSWORD: "first-pass-123",
    });
    expect(r.admin).toBe("created");
    const { user, hash } = await credentialHash(ADMIN);
    expect(user).toMatchObject({ role: "admin", emailVerified: true });
    expect(await verifyPassword({ hash, password: "first-pass-123" })).toBe(
      true,
    );
    const stages = await db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.userId, user.id));
    expect(stages.length).toBeGreaterThan(0);
  });

  it("leaves it alone while the password is unchanged", async () => {
    expect(
      await ensureAdmins(db, {
        ADMIN_EMAILS: ADMIN,
        ADMIN_PASSWORD: "first-pass-123",
      }),
    ).toMatchObject({
      admin: "unchanged",
    });
  });

  it("resets the password when ADMIN_PASSWORD changes and signs the admin out", async () => {
    const { user } = await credentialHash(ADMIN);
    await db.insert(schema.session).values({
      id: "s1",
      token: "t1",
      userId: user.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const r = await ensureAdmins(db, {
      ADMIN_EMAILS: ADMIN,
      ADMIN_PASSWORD: "second-pass-456",
    });
    expect(r.admin).toBe("password-updated");
    const { hash } = await credentialHash(ADMIN);
    expect(await verifyPassword({ hash, password: "second-pass-456" })).toBe(
      true,
    );
    expect(await verifyPassword({ hash, password: "first-pass-123" })).toBe(
      false,
    );
    expect(
      await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, user.id)),
    ).toHaveLength(0);
  });

  it("promotes listed accounts that signed up as regular users", async () => {
    await db.insert(schema.user).values({
      id: "u2",
      name: "Other",
      email: "other@trackr.test",
      role: "user",
    });
    const r = await ensureAdmins(db, {
      ADMIN_EMAILS: `${ADMIN},other@trackr.test`,
      ADMIN_PASSWORD: "second-pass-456",
    });
    expect(r.promoted).toBe(1);
    const other = await db.query.user.findFirst({
      where: eq(schema.user.email, "other@trackr.test"),
    });
    expect(other?.role).toBe("admin");
  });
});
