"use server";

import { createHash } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { cosineSimilarity } from "ai";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { answers } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import type { CurrentUser } from "@/server/session";
import { jobContext, requireProfile } from "./context";
import { toAiError, type AiResult } from "./errors";
import { draftAnswer } from "./features";
import { embedText } from "./gateway";

/** Above this, a saved answer is offered as "similar". */
const SIMILAR_AT = 0.78;

// Short-lived cache: "find similar" then "save" embeds the same question once.
const g = globalThis as unknown as {
  __embedCache?: Map<string, { v: number[]; at: number }>;
};
const cache = (g.__embedCache ??= new Map());

async function embedQuestion(user: CurrentUser, question: string) {
  const key = createHash("sha256")
    .update(`${user.id}:${question.trim().toLowerCase()}`)
    .digest("hex");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.v;
  const v = await embedText(user, question.trim());
  cache.set(key, { v, at: Date.now() });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return v;
}

const question = z
  .string()
  .trim()
  .min(8, "Write out the full question")
  .max(1000);

export type SimilarAnswer = {
  id: string;
  question: string;
  answer: string;
  score: number;
};

export async function findSimilarAnswers(
  q: string,
): Promise<AiResult<SimilarAnswer[]>> {
  const user = await requireUser();
  const parsed = question.safeParse(q);
  if (!parsed.success)
    return {
      ok: false,
      code: "BAD_OUTPUT",
      error: parsed.error.issues[0].message,
    };
  try {
    const saved = await db
      .select({
        id: answers.id,
        question: answers.question,
        answer: answers.answer,
        embedding: answers.embedding,
      })
      .from(answers)
      .where(and(eq(answers.userId, user.id), isNotNull(answers.embedding)))
      .limit(1000);
    if (saved.length === 0) return { ok: true, data: [] };
    const v = await embedQuestion(user, parsed.data);
    const ranked = saved
      .map((a) => ({
        id: a.id,
        question: a.question,
        answer: a.answer,
        score: cosineSimilarity(v, a.embedding!),
      }))
      .filter((a) => a.score >= SIMILAR_AT)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return { ok: true, data: ranked };
  } catch (err) {
    const e = toAiError(err);
    return { ok: false, code: e.code, error: e.message };
  }
}

const draftSchema = z.object({
  question,
  jobId: z.string().optional(),
  wordLimit: z.number().int().min(20).max(2000).optional(),
  context: z.string().trim().max(3000).optional(),
  baseAnswerId: z.string().optional(),
});

export async function draftAnswerAction(
  input: z.input<typeof draftSchema>,
): Promise<AiResult<{ answer: string }>> {
  const user = await requireUser();
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: "BAD_OUTPUT",
      error: parsed.error.issues[0]?.message ?? "Invalid",
    };
  const req = parsed.data;
  try {
    const profile = await requireProfile(user.id);
    const job = await jobContext(user.id, req.jobId);
    const base = req.baseAnswerId
      ? (
          await db.query.answers.findFirst({
            where: and(
              eq(answers.id, req.baseAnswerId),
              eq(answers.userId, user.id),
            ),
            columns: { answer: true },
          })
        )?.answer
      : undefined;
    const out = await draftAnswer(user, profile, job, { ...req, base });
    return { ok: true, data: { answer: out.answer.trim() } };
  } catch (err) {
    const e = toAiError(err);
    return { ok: false, code: e.code, error: e.message };
  }
}

const saveSchema = z.object({
  id: z.string().optional(),
  question,
  answer: z.string().trim().min(1, "The answer is empty").max(6000),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  jobId: z.string().optional(),
  wordLimit: z.number().int().min(20).max(2000).optional(),
});

/** Saves an answer. The question is embedded when a key is available; without one it still saves. */
export async function saveAnswer(input: z.input<typeof saveSchema>) {
  const user = await requireUser();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid answer",
    };
  const a = parsed.data;

  let embedding: number[] | null = null;
  try {
    embedding = await embedQuestion(user, a.question);
  } catch {
    // No key or quota: saved without similarity search for now.
  }
  const values = {
    question: a.question,
    answer: a.answer,
    tags: a.tags,
    jobId: a.jobId || null,
    wordLimit: a.wordLimit ?? null,
    ...(embedding ? { embedding } : {}),
  };
  if (a.id) {
    await db
      .update(answers)
      .set(values)
      .where(and(eq(answers.id, a.id), eq(answers.userId, user.id)));
  } else {
    await db.insert(answers).values({ ...values, userId: user.id });
  }
  refresh();
  return { ok: true as const, data: { searchable: Boolean(embedding) } };
}

export async function deleteAnswer(id: string) {
  const user = await requireUser();
  await db
    .delete(answers)
    .where(and(eq(answers.id, id), eq(answers.userId, user.id)));
  refresh();
}
