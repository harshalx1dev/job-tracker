import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { jobApplications, jobEvents, jobs } from "@/server/db/schema";
import { listStatuses } from "./statuses";

/** Board data for a user: statuses (ordered) and active jobs (ordered by position). */
export async function getBoard(userId: string) {
  const [statusRows, jobRows] = await Promise.all([
    listStatuses(userId),
    db
      .select()
      .from(jobs)
      .where(and(eq(jobs.userId, userId), isNull(jobs.archivedAt))),
  ]);
  // Fractional-index keys must be compared bytewise, not with DB collation.
  jobRows.sort((a, b) =>
    a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
  );
  return { statuses: statusRows, jobs: jobRows };
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
