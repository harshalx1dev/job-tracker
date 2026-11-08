"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";
import { db } from "@/server/db";
import { jobEvents, jobs, statuses } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import {
  jobInputSchema,
  moveJobSchema,
  type JobInput,
  type MoveJobInput,
} from "@/lib/validators/job";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function assertOwnStatus(userId: string, statusId: string) {
  const row = await db.query.statuses.findFirst({
    where: and(eq(statuses.id, statusId), eq(statuses.userId, userId)),
    columns: { id: true },
  });
  if (!row) throw new Error("Status not found");
}

async function lastPositionIn(userId: string, statusId: string) {
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

export async function createJob(
  input: JobInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  await assertOwnStatus(user.id, parsed.data.statusId);
  // New jobs go to the top of their column.
  const first = await db
    .select({ position: jobs.position })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, user.id),
        eq(jobs.statusId, parsed.data.statusId),
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
      ...parsed.data,
      userId: user.id,
      position: generateKeyBetween(null, minPos),
    })
    .returning({ id: jobs.id });
  await db.insert(jobEvents).values({
    jobId: row.id,
    userId: user.id,
    type: "created",
    toStatusId: parsed.data.statusId,
  });
  refresh();
  return { ok: true, data: { id: row.id } };
}

export async function updateJob(
  jobId: string,
  input: JobInput,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const existing = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.userId, user.id)),
  });
  if (!existing) return { ok: false, error: "Job not found" };

  const statusChanged = existing.statusId !== parsed.data.statusId;
  if (statusChanged) await assertOwnStatus(user.id, parsed.data.statusId);

  await db
    .update(jobs)
    .set({
      ...parsed.data,
      ...(statusChanged
        ? {
            position: generateKeyBetween(
              await lastPositionIn(user.id, parsed.data.statusId),
              null,
            ),
          }
        : {}),
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)));
  await db.insert(jobEvents).values(
    statusChanged
      ? {
          jobId,
          userId: user.id,
          type: "status_changed",
          fromStatusId: existing.statusId,
          toStatusId: parsed.data.statusId,
        }
      : { jobId, userId: user.id, type: "updated" },
  );
  refresh();
  return { ok: true, data: undefined };
}

export async function moveJob(
  input: MoveJobInput,
): Promise<ActionResult<{ position: string }>> {
  const user = await requireUser();
  const parsed = moveJobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid move" };
  const { jobId, toStatusId, beforeId, afterId } = parsed.data;

  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.userId, user.id)),
  });
  if (!job) return { ok: false, error: "Job not found" };
  await assertOwnStatus(user.id, toStatusId);

  const neighborIds = [beforeId, afterId].filter((v): v is string =>
    Boolean(v),
  );
  const neighbors = neighborIds.length
    ? await db
        .select({ id: jobs.id, position: jobs.position })
        .from(jobs)
        .where(
          and(
            eq(jobs.userId, user.id),
            eq(jobs.statusId, toStatusId),
            inArray(jobs.id, neighborIds),
          ),
        )
    : [];
  const before = neighbors.find((n) => n.id === beforeId)?.position ?? null;
  const after = neighbors.find((n) => n.id === afterId)?.position ?? null;

  let position: string;
  try {
    position = generateKeyBetween(before, after);
  } catch {
    // Neighbors out of order (concurrent edit): fall back to end of column.
    position = generateKeyBetween(
      await lastPositionIn(user.id, toStatusId),
      null,
    );
  }

  await db
    .update(jobs)
    .set({ statusId: toStatusId, position })
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)));
  if (job.statusId !== toStatusId) {
    await db.insert(jobEvents).values({
      jobId,
      userId: user.id,
      type: "status_changed",
      fromStatusId: job.statusId,
      toStatusId,
    });
  }
  return { ok: true, data: { position } };
}

export async function archiveJob(
  jobId: string,
  archived = true,
): Promise<ActionResult> {
  const user = await requireUser();
  const res = await db
    .update(jobs)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
    .returning({ id: jobs.id });
  if (!res.length) return { ok: false, error: "Job not found" };
  await db.insert(jobEvents).values({
    jobId,
    userId: user.id,
    type: archived ? "archived" : "restored",
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteJob(jobId: string): Promise<ActionResult> {
  const user = await requireUser();
  await db
    .delete(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)));
  refresh();
  return { ok: true, data: undefined };
}
