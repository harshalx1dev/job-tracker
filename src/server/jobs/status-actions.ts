"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { jobEvents, jobs, statuses } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { STATUS_COLORS } from "@/lib/status-colors";
import type { ActionResult } from "./actions";

const colorKeys = Object.keys(STATUS_COLORS) as [string, ...string[]];

const statusInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name the stage")
    .max(32, "Keep it under 32 characters"),
  color: z.enum(colorKeys),
  kind: z.enum(["open", "won", "lost"]),
});

export type StatusInput = z.input<typeof statusInput>;

const MAX_STATUSES = 12;

async function ownStatus(userId: string, id: string) {
  return db.query.statuses.findFirst({
    where: and(eq(statuses.id, id), eq(statuses.userId, userId)),
  });
}

export async function createStatus(
  input: StatusInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = statusInput.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid stage",
    };

  const existing = await db
    .select({ position: statuses.position })
    .from(statuses)
    .where(eq(statuses.userId, user.id));
  if (existing.length >= MAX_STATUSES)
    return { ok: false, error: `Up to ${MAX_STATUSES} stages` };
  const position = existing.reduce((m, s) => Math.max(m, s.position), -1) + 1;

  const [row] = await db
    .insert(statuses)
    .values({ ...parsed.data, userId: user.id, position })
    .returning({ id: statuses.id });
  refresh();
  return { ok: true, data: { id: row.id } };
}

export async function updateStatus(
  id: string,
  input: StatusInput,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = statusInput.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid stage",
    };
  if (!(await ownStatus(user.id, id)))
    return { ok: false, error: "Stage not found" };

  await db
    .update(statuses)
    .set(parsed.data)
    .where(and(eq(statuses.id, id), eq(statuses.userId, user.id)));
  refresh();
  return { ok: true, data: undefined };
}

/** Saves a new order: `ids` is every stage id, first to last. */
export async function reorderStatuses(ids: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.array(z.string().min(1)).max(MAX_STATUSES).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid order" };

  const own = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(
      and(eq(statuses.userId, user.id), inArray(statuses.id, parsed.data)),
    );
  if (own.length !== parsed.data.length)
    return { ok: false, error: "Stage not found" };

  await db.transaction(async (tx) => {
    for (const [position, id] of parsed.data.entries()) {
      await tx.update(statuses).set({ position }).where(eq(statuses.id, id));
    }
  });
  refresh();
  return { ok: true, data: undefined };
}

/** Jobs in each stage (archived included), for the delete dialog. */
export async function statusJobCounts(): Promise<Record<string, number>> {
  const user = await requireUser();
  const rows = await db
    .select({ statusId: jobs.statusId, n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(eq(jobs.userId, user.id))
    .groupBy(jobs.statusId);
  return Object.fromEntries(rows.map((r) => [r.statusId, r.n]));
}

/** Deletes a stage. Its jobs move to `moveToId` first (required when it has any). */
export async function deleteStatus(
  id: string,
  moveToId?: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const target = await ownStatus(user.id, id);
  if (!target) return { ok: false, error: "Stage not found" };

  const all = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(eq(statuses.userId, user.id))
    .orderBy(asc(statuses.position));
  if (all.length <= 2) return { ok: false, error: "Keep at least two stages" };

  const affected = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.userId, user.id), eq(jobs.statusId, id)));

  if (affected.length > 0) {
    if (!moveToId || moveToId === id || !(await ownStatus(user.id, moveToId)))
      return { ok: false, error: "Choose a stage for its jobs" };
  }

  await db.transaction(async (tx) => {
    if (affected.length > 0 && moveToId) {
      await tx
        .update(jobs)
        .set({ statusId: moveToId })
        .where(and(eq(jobs.userId, user.id), eq(jobs.statusId, id)));
      await tx.insert(jobEvents).values(
        affected.map((j) => ({
          jobId: j.id,
          userId: user.id,
          type: "status_changed" as const,
          fromStatusId: id,
          toStatusId: moveToId,
          payload: { reason: "stage deleted" },
        })),
      );
    }
    await tx
      .delete(statuses)
      .where(and(eq(statuses.id, id), eq(statuses.userId, user.id)));
    // Close the gap in positions.
    const rest = all.filter((s) => s.id !== id);
    for (const [position, s] of rest.entries()) {
      await tx.update(statuses).set({ position }).where(eq(statuses.id, s.id));
    }
  });
  refresh();
  return { ok: true, data: undefined };
}
