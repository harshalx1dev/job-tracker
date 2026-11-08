import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { answers, jobs, outreachMessages } from "@/server/db/schema";

export async function jobOptions(userId: string) {
  return db
    .select({ id: jobs.id, company: jobs.company, title: jobs.title })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), isNull(jobs.archivedAt)))
    .orderBy(desc(jobs.updatedAt));
}

export async function listOutreach(userId: string) {
  return db
    .select()
    .from(outreachMessages)
    .where(eq(outreachMessages.userId, userId))
    .orderBy(desc(outreachMessages.createdAt))
    .limit(200);
}

/** Answers without their embeddings (those never go to the browser). */
export async function listAnswers(userId: string) {
  return db
    .select({
      id: answers.id,
      question: answers.question,
      answer: answers.answer,
      tags: answers.tags,
      jobId: answers.jobId,
      wordLimit: answers.wordLimit,
      updatedAt: answers.updatedAt,
    })
    .from(answers)
    .where(eq(answers.userId, userId))
    .orderBy(desc(answers.updatedAt))
    .limit(500);
}
