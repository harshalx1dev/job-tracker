import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { jobEvents, jobs } from "@/server/db/schema";
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

export type BoardData = Awaited<ReturnType<typeof getBoard>>;
export type JobDetail = NonNullable<Awaited<ReturnType<typeof getJob>>>;
