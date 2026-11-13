import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, generateText, Output } from "ai";
import { and, count, eq, gte } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/db";
import { aiCredentials, aiSettings, aiUsage } from "@/server/db/schema";
import type { CurrentUser } from "@/server/session";
import { modelSchema } from "@/lib/ai-schema";
import { prefersDefaultTemperature, type ModelTier } from "@/lib/ai-models";
import { open } from "./crypto";
import { AiError, toAiError } from "./errors";
import { limitVerdict, type KeySource } from "./limits";

/**
 * The fallback models when a user hasn't picked one in Settings. "smart" does
 * the writing and judgement; "basic" does extraction, where a light model is
 * enough and free keys get far more requests a day. Pinned versions, because the
 * "-latest" aliases are often overloaded. Override with GEMINI_MODEL and
 * GEMINI_BASIC_MODEL.
 */
export const DEFAULT_MODELS: Record<ModelTier, string> = {
  smart: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  basic: process.env.GEMINI_BASIC_MODEL || "gemini-3.5-flash-lite",
};
export const MODEL = DEFAULT_MODELS.smart;

export type AiFeature =
  | "parse_resume"
  | "import_job"
  | "match_job"
  | "outreach"
  | "profile_questions"
  | "answer"
  | "embed"
  | "test_key";

/** Extraction only needs a light model; everything that writes or judges is "smart". */
const BASIC_FEATURES: AiFeature[] = ["parse_resume", "import_job", "test_key"];
export const tierOf = (feature: AiFeature): ModelTier =>
  BASIC_FEATURES.includes(feature) ? "basic" : "smart";

/** The model picked in Settings for this tier, else the fallback. */
export async function modelFor(userId: string, tier: ModelTier = "smart") {
  const row = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.userId, userId),
    columns: { draftModel: true, basicModel: true },
  });
  const picked = tier === "basic" ? row?.basicModel : row?.draftModel;
  return picked || DEFAULT_MODELS[tier];
}

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMS = 768;

/** The key for this user: their own first; the app key only for admins. */
export async function resolveKey(
  user: CurrentUser,
): Promise<{ apiKey: string; source: KeySource }> {
  const cred = await db.query.aiCredentials.findFirst({
    where: eq(aiCredentials.userId, user.id),
  });
  if (cred) {
    try {
      return { apiKey: open(cred), source: "user" };
    } catch {
      throw new AiError(
        "INVALID_KEY",
        "Your saved key can't be read. Remove it and add it again.",
      );
    }
  }
  if (user.role === "admin" && process.env.ADMIN_GEMINI_API_KEY) {
    return { apiKey: process.env.ADMIN_GEMINI_API_KEY, source: "admin" };
  }
  throw new AiError(
    "KEY_REQUIRED",
    "Connect a Gemini API key in Settings to use AI features.",
  );
}

async function checkLimit(userId: string, source: KeySource) {
  const now = Date.now();
  const since = (ms: number) =>
    db
      .select({ n: count() })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.userId, userId),
          gte(aiUsage.createdAt, new Date(now - ms)),
        ),
      );
  const [[hour], [day]] = await Promise.all([
    since(3_600_000),
    since(86_400_000),
  ]);
  const verdict = limitVerdict(source, hour.n, day.n);
  if (!verdict.ok) {
    throw new AiError(
      "LIMIT",
      `You've used ${verdict.limit} AI requests in the last ${verdict.window}. Try again later.`,
    );
  }
}

async function logUsage(row: typeof aiUsage.$inferInsert) {
  try {
    await db.insert(aiUsage).values(row);
  } catch {
    // Logging must never break the feature itself.
  }
}

/**
 * The one entry point for structured AI calls. Resolves the key, enforces limits,
 * calls Gemini with a schema, logs usage, and turns failures into AiError.
 */
export async function generateStructured<S extends z.ZodType>(opts: {
  user: CurrentUser;
  feature: AiFeature;
  schema: S;
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<z.infer<S>> {
  const { apiKey, source } = await resolveKey(opts.user);
  await checkLimit(opts.user.id, source);
  const google = createGoogleGenerativeAI({ apiKey });
  const tier = tierOf(opts.feature);
  const model = await modelFor(opts.user.id, tier);

  try {
    const result = await generateText({
      model: google(model),
      // Limit-free schema for Gemini; limits are applied on the way back (lib/ai-schema).
      output: Output.object({ schema: modelSchema(opts.schema) }),
      system: opts.system,
      prompt: opts.prompt,
      // Gemini 3+ keep Google's default temperature; older models use the feature's.
      temperature: prefersDefaultTemperature(model)
        ? undefined
        : (opts.temperature ?? 0.2),
      maxRetries: 2,
    });
    await logUsage({
      userId: opts.user.id,
      feature: opts.feature,
      keySource: source,
      model,
      ok: true,
      inputTokens: result.usage.inputTokens ?? null,
      outputTokens: result.usage.outputTokens ?? null,
    });
    return result.output as z.infer<S>;
  } catch (err) {
    const e = toAiError(
      err,
      model !== DEFAULT_MODELS[tier],
      `${opts.feature} on ${model}`,
    );
    await logUsage({
      userId: opts.user.id,
      feature: opts.feature,
      keySource: source,
      model,
      ok: false,
      error: e.code,
    });
    throw e;
  }
}

/** Embeds a short text for similarity search (768 dims). Limited and logged like other calls. */
export async function embedText(
  user: CurrentUser,
  value: string,
): Promise<number[]> {
  const { apiKey, source } = await resolveKey(user);
  await checkLimit(user.id, source);
  const google = createGoogleGenerativeAI({ apiKey });
  try {
    const { embedding, usage } = await embed({
      model: google.embedding(EMBEDDING_MODEL),
      value: value.slice(0, 4000),
      maxRetries: 2,
      providerOptions: {
        google: {
          outputDimensionality: EMBEDDING_DIMS,
          taskType: "SEMANTIC_SIMILARITY",
        },
      },
    });
    await logUsage({
      userId: user.id,
      feature: "embed",
      keySource: source,
      model: EMBEDDING_MODEL,
      ok: true,
      inputTokens: usage?.tokens ?? null,
    });
    return embedding;
  } catch (err) {
    const e = toAiError(err);
    await logUsage({
      userId: user.id,
      feature: "embed",
      keySource: source,
      model: EMBEDDING_MODEL,
      ok: false,
      error: e.code,
    });
    throw e;
  }
}

/** A tiny call to prove a key works before it is saved. */
export async function testKey(apiKey: string) {
  const google = createGoogleGenerativeAI({ apiKey });
  try {
    await generateText({
      // The light model: a key check shouldn't spend the scarce daily requests of a full one.
      model: google(DEFAULT_MODELS.basic),
      prompt: "Reply with the single word OK.",
      maxOutputTokens: 8,
      maxRetries: 0,
    });
  } catch (err) {
    throw toAiError(err);
  }
}

/** Requests used today, for the settings page. */
export async function usageToday(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        gte(aiUsage.createdAt, new Date(Date.now() - 86_400_000)),
      ),
    );
  return row.n;
}
