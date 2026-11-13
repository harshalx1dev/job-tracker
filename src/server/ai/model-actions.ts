"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import type { ModelOption } from "@/lib/ai-models";
import { db } from "@/server/db";
import { aiSettings, aiUsage } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { toAiError, type AiResult } from "./errors";
import { resolveKey } from "./gateway";
import { checkModelAccess, fetchDraftModels, MODEL_ID } from "./models";

/**
 * Sets the model for outreach and answer drafts. Only a model this key lists,
 * and only after a tiny test call proves the key can actually use it. Passing
 * null goes back to the default model.
 */
export async function chooseDraftModel(
  modelId: string | null,
  custom = false,
): Promise<AiResult<{ model: string | null }>> {
  const user = await requireUser();

  if (modelId === null) {
    await db
      .insert(aiSettings)
      .values({ userId: user.id, draftModel: null })
      .onConflictDoUpdate({
        target: aiSettings.userId,
        set: { draftModel: null, updatedAt: new Date() },
      });
    refresh();
    return { ok: true, data: { model: null } };
  }

  if (!MODEL_ID.test(modelId)) {
    return { ok: false, code: "FAILED", error: "That isn't a Gemini model." };
  }

  let apiKey: string;
  let source: "user" | "admin";
  try {
    ({ apiKey, source } = await resolveKey(user));
  } catch (err) {
    const e = toAiError(err);
    return { ok: false, code: e.code, error: e.message };
  }

  // A typed-in id skips the list (the list's filter may hide newer model names);
  // the test call below still proves the key can use it.
  let option: ModelOption;
  if (custom) {
    option = { id: modelId, label: modelId, preview: false };
  } else {
    const options = await fetchDraftModels(apiKey).catch(() => null);
    if (!options) {
      return {
        ok: false,
        code: "FAILED",
        error: "Couldn't load the models for your key. Try again in a moment.",
      };
    }
    const found = options.find((o) => o.id === modelId);
    if (!found) {
      return {
        ok: false,
        code: "FAILED",
        error: "Your key doesn't offer this model.",
      };
    }
    option = found;
  }

  const access = await checkModelAccess(apiKey, modelId);
  try {
    await db.insert(aiUsage).values({
      userId: user.id,
      feature: "test_key",
      keySource: source,
      model: modelId,
      ok: access === "ok",
      error: access === "ok" ? null : `MODEL_${access.toUpperCase()}`,
    });
  } catch {
    // Logging must never break the feature itself.
  }

  if (access === "retry") {
    return {
      ok: false,
      code: "PROVIDER_LIMIT",
      error: `${option.label} is busy or rate-limited right now. Try again in a minute.`,
    };
  }

  const existing = await db.query.aiSettings.findFirst({
    where: (t, { eq }) => eq(t.userId, user.id),
  });
  const modelAccess = { ...(existing?.modelAccess ?? {}), [modelId]: access };
  const set =
    access === "ok"
      ? { draftModel: modelId, modelAccess, updatedAt: new Date() }
      : { modelAccess, updatedAt: new Date() };
  await db
    .insert(aiSettings)
    .values({ userId: user.id, ...set })
    .onConflictDoUpdate({ target: aiSettings.userId, set });
  refresh();

  if (access === "blocked") {
    return {
      ok: false,
      code: "FAILED",
      error: `Your key can't use ${option.label}. On Gemini's free tier, Pro models need a paid key; other models may be retired for new keys.`,
    };
  }
  return { ok: true, data: { model: modelId } };
}

/**
 * Reloads the models the key offers and forgets earlier "blocked" results, so a
 * model that was unavailable (or newly released) gets tested again when picked.
 */
export async function refreshModels(): Promise<AiResult<{ count: number }>> {
  const user = await requireUser();
  let apiKey: string;
  try {
    ({ apiKey } = await resolveKey(user));
  } catch (err) {
    const e = toAiError(err);
    return { ok: false, code: e.code, error: e.message };
  }
  const options = await fetchDraftModels(apiKey).catch(() => null);
  if (!options) {
    return {
      ok: false,
      code: "FAILED",
      error: "Couldn't load the models for your key. Try again in a moment.",
    };
  }
  await db
    .update(aiSettings)
    .set({ modelAccess: {}, updatedAt: new Date() })
    .where(eq(aiSettings.userId, user.id));
  refresh();
  return { ok: true, data: { count: options.length } };
}
