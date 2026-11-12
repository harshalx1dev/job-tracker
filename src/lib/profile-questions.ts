import { z } from "zod";

/**
 * "Questions for you": the AI asks about gaps in a profile, the user answers,
 * skips or says they don't know. Pure rules live here (limits, de-duplication,
 * validation, the text added to AI prompts); the database is in src/server.
 */

export type QuestionStatus = "pending" | "answered" | "na" | "unsure";

/** More than this waiting for an answer and "Suggest questions" asks the user to catch up first. */
export const MAX_PENDING = 10;
export const BATCH_SIZE = 8;
export const MAX_QUESTION = 300;
export const MAX_ABOUT = 120;
export const MAX_ANSWER = 1000;

/** What goes into AI prompts: the newest answers, within a size budget. */
export const BACKGROUND_MAX_NOTES = 30;
export const BACKGROUND_MAX_CHARS = 6000;

/** What the generator is shown to avoid repeating itself, across every status. */
export const PRIOR_QUESTIONS_MAX = 60;

export type BackgroundNote = { question: string; answer: string };

/** A question for comparisons: case, punctuation and spacing don't make it new. */
export function normalizeQuestion(q: string) {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** New questions that are not repeats of existing ones (or of each other), up to the limit. */
export function freshQuestions<T extends { question: string }>(
  candidates: T[],
  existing: string[],
  limit: number,
): T[] {
  const seen = new Set(existing.map(normalizeQuestion));
  const out: T[] = [];
  for (const c of candidates) {
    const key = normalizeQuestion(c.question);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

/** What a user can do with a question. An answer is only needed (and kept) for "answered". */
export const questionUpdateSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("answered"),
    answer: z
      .string()
      .trim()
      .min(1, "Write an answer first.")
      .max(MAX_ANSWER, `Keep it under ${MAX_ANSWER} characters.`),
  }),
  z.object({ status: z.literal("na") }),
  z.object({ status: z.literal("unsure") }),
  z.object({ status: z.literal("pending") }),
]);

export type QuestionUpdate = z.infer<typeof questionUpdateSchema>;

/**
 * The block added to AI prompts from answered questions. Newest first, then
 * capped by count and size so a long history can't crowd out the resume.
 * `notes` must be ordered newest first.
 */
export function backgroundToPrompt(notes: BackgroundNote[]): string {
  const lines: string[] = [];
  let size = 0;
  for (const n of notes.slice(0, BACKGROUND_MAX_NOTES)) {
    const entry = `Q: ${n.question.trim()}\nA: ${n.answer.trim()}`;
    if (size + entry.length > BACKGROUND_MAX_CHARS) break;
    lines.push(entry);
    size += entry.length + 1;
  }
  return lines.length
    ? `Background the candidate added in their own words:\n${lines.join("\n")}`
    : "";
}
