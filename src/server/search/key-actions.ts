"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { apifyCredentials } from "@/server/db/schema";
import { lastFour, seal } from "@/server/ai/crypto";
import { requireUser } from "@/server/session";
import { ApifyAuthError, ApifyError, whoAmI } from "./apify";

export type ApifyKeyResult =
  | { ok: true; data: { last4: string; username: string } }
  | { ok: false; error: string };

const tokenSchema = z
  .string()
  .trim()
  .min(20, "That doesn't look like an Apify API token")
  .max(200)
  .regex(/^\S+$/, "API tokens have no spaces");

/** Checks the token with Apify, then stores it encrypted. Only the last 4 characters come back. */
export async function saveApifyToken(raw: string): Promise<ApifyKeyResult> {
  const user = await requireUser();
  const parsed = tokenSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid token",
    };
  const token = parsed.data;

  let username: string;
  try {
    username = await whoAmI(token);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof ApifyAuthError
          ? "Apify didn't accept that token. Check that you copied all of it."
          : err instanceof ApifyError
            ? err.message
            : "Couldn't check the token.",
    };
  }
  let sealed;
  try {
    sealed = seal(token);
  } catch {
    return {
      ok: false,
      error:
        "The server can't store keys yet (ENCRYPTION_KEY is missing). Ask the admin.",
    };
  }
  const values = {
    ...sealed,
    last4: lastFour(token),
    username,
    validatedAt: new Date(),
  };
  await db
    .insert(apifyCredentials)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: apifyCredentials.userId, set: values });
  refresh();
  return { ok: true, data: { last4: values.last4, username } };
}

export async function removeApifyToken(): Promise<{ ok: true }> {
  const user = await requireUser();
  await db.delete(apifyCredentials).where(eq(apifyCredentials.userId, user.id));
  refresh();
  return { ok: true };
}
