import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { reviewedJobs } from "@/server/db/schema";

/** The log of every listing Claude looked at, with the decision and why. */

export const reviewedEntrySchema = z.object({
  company: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  url: z.string().max(2000).optional(),
  source: z.string().min(1).max(60),
  decision: z.enum(["saved", "skipped"]),
  score: z.number().int().min(0).max(100).optional(),
  reason: z.string().min(1).max(300),
});
export type ReviewedEntry = z.infer<typeof reviewedEntrySchema>;

const keyOf = (e: Pick<ReviewedEntry, "company" | "title" | "url">) =>
  e.url?.trim().replace(/\/+$/, "").toLowerCase() ||
  `${e.company.trim()}|${e.title.trim()}`.toLowerCase();

/** Adds the entries, or updates the row when the same listing was logged before. */
export async function logReviewed(userId: string, entries: ReviewedEntry[]) {
  if (!entries.length) return 0;
  // One statement can't touch the same key twice: keep the last entry per key.
  const byKey = new Map(entries.map((e) => [keyOf(e), e]));
  const now = new Date();
  await db
    .insert(reviewedJobs)
    .values(
      [...byKey].map(([key, e]) => ({
        userId,
        key,
        source: e.source,
        company: e.company,
        title: e.title,
        url: e.url || null,
        decision: e.decision,
        score: e.score ?? null,
        reason: e.reason,
        reviewedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [reviewedJobs.userId, reviewedJobs.key],
      set: {
        decision: sql`excluded.decision`,
        score: sql`excluded.score`,
        reason: sql`excluded.reason`,
        source: sql`excluded.source`,
        reviewedAt: now,
      },
    });
  return byKey.size;
}

export async function listReviewed(
  userId: string,
  opts: { query?: string; decision?: "saved" | "skipped"; limit?: number } = {},
) {
  const q = opts.query?.replace(/[\%_]/g, "\$&");
  return db
    .select()
    .from(reviewedJobs)
    .where(
      and(
        eq(reviewedJobs.userId, userId),
        opts.decision ? eq(reviewedJobs.decision, opts.decision) : undefined,
        q
          ? or(
              ilike(reviewedJobs.company, `%${q}%`),
              ilike(reviewedJobs.title, `%${q}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(reviewedJobs.reviewedAt))
    .limit(Math.min(opts.limit ?? 200, 500));
}
export type ReviewedJob = Awaited<ReturnType<typeof listReviewed>>[number];
