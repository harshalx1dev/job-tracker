import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  jobs,
  prepPlanItems,
  prepPlans,
  prepProgress,
  questions,
} from "@/server/db/schema";

/** Plans with their size, minutes and (for this viewer) how many are done. */
async function withStats(userId: string, planIds: string[]) {
  if (planIds.length === 0)
    return new Map<string, { total: number; minutes: number; done: number }>();
  const [sizes, done] = await Promise.all([
    db
      .select({
        planId: prepPlanItems.planId,
        total: count(),
        minutes: sql<number>`coalesce(sum(${questions.estMinutes}), 0)::int`,
      })
      .from(prepPlanItems)
      .innerJoin(questions, eq(questions.id, prepPlanItems.questionId))
      .where(inArray(prepPlanItems.planId, planIds))
      .groupBy(prepPlanItems.planId),
    db
      .select({ planId: prepProgress.planId, done: count() })
      .from(prepProgress)
      .where(
        and(
          eq(prepProgress.userId, userId),
          inArray(prepProgress.planId, planIds),
          inArray(prepProgress.state, ["done", "confident"]),
        ),
      )
      .groupBy(prepProgress.planId),
  ]);
  const out = new Map<
    string,
    { total: number; minutes: number; done: number }
  >();
  for (const s of sizes)
    out.set(s.planId, { total: s.total, minutes: s.minutes, done: 0 });
  for (const d of done)
    out.set(d.planId, {
      ...(out.get(d.planId) ?? { total: 0, minutes: 0 }),
      done: d.done,
    });
  return out;
}

export async function plansForJob(userId: string, jobId: string) {
  const rows = await db
    .select()
    .from(prepPlans)
    .where(and(eq(prepPlans.userId, userId), eq(prepPlans.jobId, jobId)));
  const stats = await withStats(
    userId,
    rows.map((r) => r.id),
  );
  const order = { crash: 0, multiday: 1, full: 2 } as Record<string, number>;
  return rows
    .map((r) => ({
      ...r,
      ...(stats.get(r.id) ?? { total: 0, minutes: 0, done: 0 }),
    }))
    .sort((a, b) => order[a.kind] - order[b.kind]);
}

export async function listPlans(userId: string) {
  const rows = await db
    .select({
      plan: prepPlans,
      company: jobs.company,
      title: jobs.title,
      interviewAt: jobs.interviewAt,
    })
    .from(prepPlans)
    .innerJoin(jobs, eq(jobs.id, prepPlans.jobId))
    .where(eq(prepPlans.userId, userId))
    .orderBy(desc(prepPlans.generatedAt));
  const stats = await withStats(
    userId,
    rows.map((r) => r.plan.id),
  );
  return rows.map((r) => ({
    ...r,
    ...(stats.get(r.plan.id) ?? { total: 0, minutes: 0, done: 0 }),
  }));
}

/**
 * Everything the prep workspace shows. Access: the owner always; anyone else only
 * through a link-visible plan (by token). Progress is the viewer's own.
 */
export async function loadPlan(
  by: { planId: string; ownerId: string } | { token: string },
  viewerId: string | null,
) {
  const [row] = await db
    .select({
      plan: prepPlans,
      company: jobs.company,
      title: jobs.title,
      interviewAt: jobs.interviewAt,
    })
    .from(prepPlans)
    .innerJoin(jobs, eq(jobs.id, prepPlans.jobId))
    .where(
      "token" in by
        ? and(
            eq(prepPlans.shareToken, by.token),
            eq(prepPlans.visibility, "link"),
          )
        : and(eq(prepPlans.id, by.planId), eq(prepPlans.userId, by.ownerId)),
    );
  if (!row) return null;

  const [items, progress] = await Promise.all([
    db
      .select({
        id: questions.id,
        day: prepPlanItems.day,
        position: prepPlanItems.position,
        topic: questions.topic,
        subtopic: questions.subtopic,
        priority: questions.priority,
        difficulty: questions.difficulty,
        estMinutes: questions.estMinutes,
        question: questions.question,
        answer: questions.answer,
        references: questions.references,
      })
      .from(prepPlanItems)
      .innerJoin(questions, eq(questions.id, prepPlanItems.questionId))
      .where(eq(prepPlanItems.planId, row.plan.id))
      .orderBy(asc(prepPlanItems.day), asc(prepPlanItems.position)),
    viewerId
      ? db
          .select({
            questionId: prepProgress.questionId,
            state: prepProgress.state,
          })
          .from(prepProgress)
          .where(
            and(
              eq(prepProgress.userId, viewerId),
              eq(prepProgress.planId, row.plan.id),
            ),
          )
      : Promise.resolve([]),
  ]);

  return {
    ...row,
    items,
    progress: Object.fromEntries(
      progress.map((p) => [p.questionId, p.state]),
    ) as Record<string, string>,
  };
}

export type PlanView = NonNullable<Awaited<ReturnType<typeof loadPlan>>>;
export type JobPlan = Awaited<ReturnType<typeof plansForJob>>[number];
