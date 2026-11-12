import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { db } from "@/server/db";
import { jobEvents, jobs, statuses } from "@/server/db/schema";
import type { JobMatch } from "@/lib/ai-schemas";
import type { ParsedJob } from "@/lib/validators/job";

/*
 * Job logic that takes a userId, shared by the server actions (which get the
 * user from the session) and the Claude connector (which gets it from a token).
 * Callers are responsible for who the user is; everything here is scoped to it.
 */

export async function assertOwnStatus(userId: string, statusId: string) {
  const row = await db.query.statuses.findFirst({
    where: and(eq(statuses.id, statusId), eq(statuses.userId, userId)),
    columns: { id: true },
  });
  if (!row) throw new Error("Status not found");
}

export async function lastPositionIn(userId: string, statusId: string) {
  const rows = await db
    .select({ position: jobs.position })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        eq(jobs.statusId, statusId),
        isNull(jobs.archivedAt),
      ),
    );
  return rows.reduce<string | null>(
    (max, r) => (max === null || r.position > max ? r.position : max),
    null,
  );
}

/** Adds a job at the top of its column and records that it was created. */
export async function insertJob(
  userId: string,
  data: ParsedJob,
  extra: {
    claudeMatch?: JobMatch;
    /** Stored on the "created" history entry, e.g. { via: "claude" }. */
    eventPayload?: Record<string, unknown>;
  } = {},
) {
  await assertOwnStatus(userId, data.statusId);
  const first = await db
    .select({ position: jobs.position })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        eq(jobs.statusId, data.statusId),
        isNull(jobs.archivedAt),
      ),
    );
  const minPos = first.reduce<string | null>(
    (min, r) => (min === null || r.position < min ? r.position : min),
    null,
  );

  const [row] = await db
    .insert(jobs)
    .values({
      ...data,
      userId,
      position: generateKeyBetween(null, minPos),
      ...(extra.claudeMatch ? { claudeMatch: extra.claudeMatch } : {}),
    })
    .returning({ id: jobs.id });
  await db.insert(jobEvents).values({
    jobId: row.id,
    userId,
    type: "created",
    toStatusId: data.statusId,
    ...(extra.eventPayload ? { payload: extra.eventPayload } : {}),
  });
  return row;
}
