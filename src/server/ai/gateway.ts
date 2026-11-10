import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, generateText, Output } from "ai";
import { and, count, eq, gte } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/server/db";
import { aiCredentials, aiSettings, aiUsage } from "@/server/db/schema";
import type { CurrentUser } from "@/server/session";
import { open } from "./crypto";
import { AiError, toAiError } from "./errors";
import { limitVerdict, type KeySource } from "./limits";

/** Free-tier friendly alias that follows Google's newest Flash model. Override with GEMINI_MODEL. */
export const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export type AiFeature =
  | "parse_resume"
  | "import_job"
  | "match_job"
  | "outreach"
  | "answer"
  | "embed"
  | "test_key";

/** Features that write prose for the user; they use the model picked in Settings. */
const DRAFT_FEATURES: readonly AiFeature[] = ["outreach", "answer"];

async function modelFor(userId: string, feature: AiFeature) {
  if (!DRAFT_FEATURES.includes(feature)) return MODEL;
  const row = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.userId, userId),
    columns: { draftModel: true },
  });
  return row?.draftModel || MODEL;
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
  const model = await modelFor(opts.user.id, opts.feature);

  try {
    const result = await generateText({
      model: google(model),
      output: Output.object({ schema: opts.schema }),
      system: opts.system,
      prompt: opts.prompt,
      temperature: opts.temperature ?? 0.2,
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
    const e = toAiError(err, model !== MODEL);
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
      model: google(MODEL),
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
