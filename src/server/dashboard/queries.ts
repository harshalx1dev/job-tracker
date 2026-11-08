import "server-only";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { jobEvents, jobs } from "@/server/db/schema";
import { listStatuses } from "@/server/jobs/statuses";
import { computeDashboard } from "@/lib/dashboard";

export async function getDashboard(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [statusRows, jobRows, eventRows] = await Promise.all([
    listStatuses(userId),
    db
      .select({
        id: jobs.id,
        company: jobs.company,
        title: jobs.title,
        statusId: jobs.statusId,
        appliedAt: jobs.appliedAt,
        interviewAt: jobs.interviewAt,
        createdAt: jobs.createdAt,
        updatedAt: jobs.updatedAt,
      })
      .from(jobs)
      .where(and(eq(jobs.userId, userId), isNull(jobs.archivedAt))),
    db
      .select({
        id: jobEvents.id,
        jobId: jobEvents.jobId,
        type: jobEvents.type,
        fromStatusId: jobEvents.fromStatusId,
        toStatusId: jobEvents.toStatusId,
        createdAt: jobEvents.createdAt,
      })
      .from(jobEvents)
      .where(and(eq(jobEvents.userId, userId), gte(jobEvents.createdAt, since)))
      .orderBy(desc(jobEvents.createdAt))
      .limit(200),
  ]);
  return computeDashboard(jobRows, statusRows, eventRows, now);
}
