"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { profileQuestions, type ProfileQuestion } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { requireProfile } from "@/server/ai/context";
import { AiError, toAiError, type AiResult } from "@/server/ai/errors";
import { generateProfileQuestions } from "@/server/ai/features";
import type { ActionResult } from "@/server/jobs/actions";
import {
  BATCH_SIZE,
  MAX_ABOUT,
  MAX_PENDING,
  MAX_QUESTION,
  PRIOR_QUESTIONS_MAX,
  freshQuestions,
  questionUpdateSchema,
  type QuestionUpdate,
} from "@/lib/profile-questions";

/*
 * These actions return the changed rows and do not call refresh(): the Profile
 * page keeps the question list in its own state, and a refresh would hand the
 * profile form a new object and discard anything typed there but not saved.
 */

/** Asks the AI for a new batch of questions about the profile and stores them. */
export async function suggestQuestions(): Promise<AiResult<ProfileQuestion[]>> {
  const user = await requireUser();
  try {
    const profile = await requireProfile(user.id);
    const rows = await db.query.profileQuestions.findMany({
      where: eq(profileQuestions.userId, user.id),
      orderBy: desc(profileQuestions.createdAt),
      columns: { question: true, status: true },
    });

    const pending = rows.filter((r) => r.status === "pending").length;
    if (pending >= MAX_PENDING)
      throw new AiError(
        "BAD_OUTPUT",
        `You have ${pending} questions waiting. Answer or skip a few first.`,
      );
    const want = Math.min(BATCH_SIZE, MAX_PENDING - pending);

    const generated = await generateProfileQuestions(
      user,
      profile,
      rows.slice(0, PRIOR_QUESTIONS_MAX),
      want,
    );
    const fresh = freshQuestions(
      generated.map((q) => ({
        question: q.question.trim().slice(0, MAX_QUESTION),
        about: q.about.trim().slice(0, MAX_ABOUT),
      })),
      rows.map((r) => r.question),
      want,
    );
    if (!fresh.length)
      throw new AiError(
        "BAD_OUTPUT",
        "No new questions this time: your profile looks well covered. Try again after you add more.",
      );

    // One statement gives every row the same timestamp, so stamp them in order:
    // the page lists the oldest first, which keeps "most valuable first".
    const now = Date.now();
    const inserted = await db
      .insert(profileQuestions)
      .values(
        fresh.map((f, i) => ({
          userId: user.id,
          question: f.question,
          about: f.about || null,
          createdAt: new Date(now + i),
        })),
      )
      .returning();
    return { ok: true, data: inserted };
  } catch (err) {
    const e = toAiError(err);
    return { ok: false, code: e.code, error: e.message };
  }
}

/** Answer, mark "not relevant" or "no idea", or reopen a question. */
export async function updateQuestion(
  id: string,
  update: QuestionUpdate,
): Promise<ActionResult<ProfileQuestion>> {
  const user = await requireUser();
  const parsedId = z.string().min(1).max(100).safeParse(id);
  const parsed = questionUpdateSchema.safeParse(update);
  if (!parsedId.success || !parsed.success)
    return {
      ok: false,
      error: parsed.success
        ? "Question not found"
        : (parsed.error.issues[0]?.message ?? "Invalid answer"),
    };

  const [row] = await db
    .update(profileQuestions)
    .set({
      status: parsed.data.status,
      answer: parsed.data.status === "answered" ? parsed.data.answer : null,
    })
    .where(
      and(
        eq(profileQuestions.id, parsedId.data),
        eq(profileQuestions.userId, user.id),
      ),
    )
    .returning();
  if (!row) return { ok: false, error: "Question not found" };
  return { ok: true, data: row };
}
