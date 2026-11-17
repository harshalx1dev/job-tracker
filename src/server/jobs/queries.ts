import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { jobApplications, jobEvents, jobs } from "@/server/db/schema";
import { listStatuses } from "./statuses";

/** Archived jobs, most recently archived first, each with the reason the user gave (if any). */
export async function listArchived(userId: string) {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), isNotNull(jobs.archivedAt)))
    .orderBy(desc(jobs.archivedAt));
  if (!rows.length) return [];
  const events = await db
    .select({
      jobId: jobEvents.jobId,
      payload: jobEvents.payload,
    })
    .from(jobEvents)
    .where(
      and(
        eq(jobEvents.userId, userId),
        eq(jobEvents.type, "archived"),
        inArray(
          jobEvents.jobId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .orderBy(desc(jobEvents.createdAt));
  const reasons = new Map<string, string>();
  for (const e of events) {
    // Newest first: keep the first one seen per job.
    if (!reasons.has(e.jobId) && typeof e.payload?.reason === "string")
      reasons.set(e.jobId, e.payload.reason);
  }
  return rows.map((j) => ({ ...j, archiveReason: reasons.get(j.id) ?? null }));
}
export type ArchivedJob = Awaited<ReturnType<typeof listArchived>>[number];

/** Board data for a user: statuses (ordered) and active jobs (ordered by position). */
export async function getBoard(userId: string) {
  const [statusRows, jobRows, archived] = await Promise.all([
    listStatuses(userId),
    db
      .select()
      .from(jobs)
      .where(and(eq(jobs.userId, userId), isNull(jobs.archivedAt))),
    listArchived(userId),
  ]);
  // Fractional-index keys must be compared bytewise, not with DB collation.
  jobRows.sort((a, b) =>
    a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
  );
  return { statuses: statusRows, jobs: jobRows, archived };
}

export async function getJob(userId: string, jobId: string) {
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)),
    with: {
      status: true,
      events: { orderBy: desc(jobEvents.createdAt), limit: 50 },
      contacts: true,
    },
  });
  return job ?? null;
}

/** Attempts to apply to a job, newest first. Empty if the table isn't migrated yet. */
export async function listApplications(userId: string, jobId: string) {
  try {
    return await db
      .select({
        id: jobApplications.id,
        platform: jobApplications.platform,
        outcome: jobApplications.outcome,
        url: jobApplications.url,
        resumeId: jobApplications.resumeId,
        resumeTitle: jobApplications.resumeTitle,
        submitted: jobApplications.submitted,
        failureReason: jobApplications.failureReason,
        notes: jobApplications.notes,
        createdAt: jobApplications.createdAt,
      })
      .from(jobApplications)
      .where(
        and(
          eq(jobApplications.jobId, jobId),
          eq(jobApplications.userId, userId),
        ),
      )
      .orderBy(desc(jobApplications.createdAt));
  } catch (err) {
    console.error("job_applications unavailable (run npm run db:migrate)", err);
    return [];
  }
}
export type JobApplication = Awaited<
  ReturnType<typeof listApplications>
>[number];

export type BoardData = Awaited<ReturnType<typeof getBoard>>;
export type JobDetail = NonNullable<Awaited<ReturnType<typeof getJob>>>;
