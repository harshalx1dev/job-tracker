import "server-only";
import { eq } from "drizzle-orm";
import {
  classifyModelError,
  pickDraftModels,
  type ModelAccess,
  type ModelOption,
} from "@/lib/ai-models";
import { db } from "@/server/db";
import { aiSettings } from "@/server/db/schema";
import type { CurrentUser } from "@/server/session";
import { AiError } from "./errors";
import { MODEL, resolveKey } from "./gateway";

const API = "https://generativelanguage.googleapis.com/v1beta";

/** Model ids are put in a URL path: allow only what Gemini ids look like. */
export const MODEL_ID = /^gemini-[a-z0-9.-]{1,60}$/;

/** The key travels in a header, never in the URL (URLs end up in logs). */
const headers = (apiKey: string) => ({
  "x-goog-api-key": apiKey,
  "content-type": "application/json",
});

/** The draft-capable models this key can see (Google's ListModels, filtered). */
export async function fetchDraftModels(apiKey: string): Promise<ModelOption[]> {
  const res = await fetch(`${API}/models?pageSize=1000`, {
    headers: headers(apiKey),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ListModels ${res.status}`);
  const json = (await res.json()) as { models?: [] };
  return pickDraftModels(json.models ?? []);
}

/**
 * One tiny call with the model. Being listed doesn't mean a key can use a
 * model: free keys see Pro models but have a quota of zero for them.
 */
export async function checkModelAccess(
  apiKey: string,
  model: string,
): Promise<ModelAccess> {
  if (!MODEL_ID.test(model)) return "blocked";
  try {
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: "POST",
      headers: headers(apiKey),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with the single word OK." }] }],
        generationConfig: { maxOutputTokens: 16 },
      }),
    });
    if (res.ok) return "ok";
    return classifyModelError(res.status, await res.text());
  } catch {
    return "retry"; // network or timeout: says nothing about access
  }
}

export type ModelPicker =
  | { state: "no-key" }
  | { state: "error"; defaultModel: string }
  | {
      state: "ready";
      defaultModel: string;
      selected: string | null;
      options: ModelOption[];
      access: Record<string, "ok" | "blocked">;
    };

/** What the Settings model picker shows for this user's key. */
export async function getModelPicker(user: CurrentUser): Promise<ModelPicker> {
  let apiKey: string;
  try {
    ({ apiKey } = await resolveKey(user));
  } catch (err) {
    if (err instanceof AiError) return { state: "no-key" };
    throw err;
  }
  const [settings, options] = await Promise.all([
    db.query.aiSettings.findFirst({ where: eq(aiSettings.userId, user.id) }),
    fetchDraftModels(apiKey).catch(() => null),
  ]);
  if (!options) return { state: "error", defaultModel: MODEL };
  return {
    state: "ready",
    defaultModel: MODEL,
    selected: settings?.draftModel ?? null,
    options,
    access: settings?.modelAccess ?? {},
  };
}
