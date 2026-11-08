"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { aiCredentials } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { lastFour, seal } from "./crypto";
import { toAiError, type AiResult } from "./errors";
import { testKey } from "./gateway";

const keySchema = z
  .string()
  .trim()
  .min(20, "That doesn't look like a Gemini API key")
  .max(200)
  .regex(/^\S+$/, "API keys have no spaces");

/** Tests the key with a tiny call, then stores it encrypted. Only the last 4 characters come back. */
export async function saveAiKey(
  raw: string,
): Promise<AiResult<{ last4: string }>> {
  const user = await requireUser();
  const parsed = keySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_KEY",
      error: parsed.error.issues[0]?.message ?? "Invalid key",
    };
  }
  const apiKey = parsed.data;
  try {
    await testKey(apiKey);
  } catch (err) {
    const e = toAiError(err);
    return { ok: false, code: e.code, error: e.message };
  }

  let sealed;
  try {
    sealed = seal(apiKey);
  } catch {
    return {
      ok: false,
      code: "FAILED",
      error:
        "The server can't store keys yet (ENCRYPTION_KEY is missing). Ask the admin.",
    };
  }
  const values = {
    ...sealed,
    last4: lastFour(apiKey),
    validatedAt: new Date(),
    provider: "google",
  };
  await db
    .insert(aiCredentials)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: aiCredentials.userId, set: values });
  refresh();
  return { ok: true, data: { last4: values.last4 } };
}

export async function removeAiKey(): Promise<AiResult<null>> {
  const user = await requireUser();
  await db.delete(aiCredentials).where(eq(aiCredentials.userId, user.id));
  refresh();
  return { ok: true, data: null };
}
