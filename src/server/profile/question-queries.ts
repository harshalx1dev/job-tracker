import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { profileQuestions, type ProfileQuestion } from "@/server/db/schema";
import {
  BACKGROUND_MAX_NOTES,
  type BackgroundNote,
} from "@/lib/profile-questions";

/**
 * The user's questions, pending first then newest. Null when the table can't
 * be read (the database hasn't been migrated yet): the Profile page then
 * hides this section instead of failing as a whole.
 */
export async function getProfileQuestions(
  userId: string,
): Promise<ProfileQuestion[] | null> {
  try {
    return await db.query.profileQuestions.findMany({
      where: eq(profileQuestions.userId, userId),
      orderBy: desc(profileQuestions.createdAt),
    });
  } catch (err) {
    console.error(
      "profile_questions unavailable (run npm run db:migrate)",
      err,
    );
    return null;
  }
}

/** Answered questions, newest first, for AI prompts. Empty if the table can't be read. */
export async function getBackground(userId: string): Promise<BackgroundNote[]> {
  try {
    const rows = await db.query.profileQuestions.findMany({
      where: and(
        eq(profileQuestions.userId, userId),
        eq(profileQuestions.status, "answered"),
      ),
      orderBy: desc(profileQuestions.updatedAt),
      limit: BACKGROUND_MAX_NOTES,
      columns: { question: true, answer: true },
    });
    return rows.flatMap((r) =>
      r.answer ? [{ question: r.question, answer: r.answer }] : [],
    );
  } catch (err) {
    console.error(
      "profile_questions unavailable (run npm run db:migrate)",
      err,
    );
    return [];
  }
}
