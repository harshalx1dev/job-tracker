"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import {
  jobs,
  prepPlanItems,
  prepPlans,
  prepProgress,
  questions,
} from "@/server/db/schema";
import { getCurrentUser, requireAdmin, requireUser } from "@/server/session";
import {
  buildCrash,
  buildFull,
  buildMultiDay,
  matchQuestions,
  suggestPlan,
  type PlanItem,
} from "@/lib/prep";
import { parseQuestionFile } from "@/lib/question-import";
import type { ActionResult } from "@/server/jobs/actions";
import { writeImport } from "./importer";

const CRASH_BUDGET = 360;

/** Builds (or rebuilds) the job's three plans. Share settings and progress are kept. */
export async function generatePrepPlans(
  jobId: string,
  days?: number,
): Promise<ActionResult<{ matched: number }>> {
  const user = await requireUser();
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.userId, user.id)),
    columns: { id: true, skills: true, interviewAt: true },
  });
  if (!job) return { ok: false, error: "Job not found" };
  if (job.skills.length === 0) {
    return {
      ok: false,
      error:
        "Add skills to this job first (edit the job, or import it from a posting).",
    };
  }

  const bank = await db
    .select({
      id: questions.id,
      topic: questions.topic,
      skills: questions.skills,
      priority: questions.priority,
      frequency: questions.frequency,
      estMinutes: questions.estMinutes,
    })
    .from(questions);
  const matched = matchQuestions(
    bank.map((q) => ({ ...q, priority: q.priority as "P1" | "P2" | "P3" })),
    job.skills,
  );
  if (matched.length === 0) {
    return {
      ok: false,
      error: "No questions in the bank match this job's skills yet.",
    };
  }

  const multiDays = days ?? suggestPlan(job.interviewAt, new Date()).days;
  const plans: { kind: string; days: number; items: PlanItem[] }[] = [
    { kind: "crash", days: 1, items: buildCrash(matched, CRASH_BUDGET) },
    {
      kind: "multiday",
      days: Math.max(2, multiDays),
      items: buildMultiDay(matched, Math.max(2, multiDays)),
    },
    { kind: "full", days: 0, items: buildFull(matched) },
  ];

  await db.transaction(async (tx) => {
    for (const p of plans) {
      const [plan] = await tx
        .insert(prepPlans)
        .values({ userId: user.id, jobId, kind: p.kind, days: p.days })
        .onConflictDoUpdate({
          target: [prepPlans.jobId, prepPlans.kind],
          set: { days: p.days, generatedAt: new Date() },
        })
        .returning({ id: prepPlans.id });
      await tx.delete(prepPlanItems).where(eq(prepPlanItems.planId, plan.id));
      if (p.items.length) {
        await tx
          .insert(prepPlanItems)
          .values(p.items.map((i) => ({ ...i, planId: plan.id })));
      }
    }
  });
  refresh();
  return { ok: true, data: { matched: matched.length } };
}

async function ownPlan(userId: string, planId: string) {
  return db.query.prepPlans.findFirst({
    where: and(eq(prepPlans.id, planId), eq(prepPlans.userId, userId)),
  });
}

const newToken = () => randomBytes(24).toString("base64url");

export async function setPlanVisibility(
  planId: string,
  visibility: "private" | "link",
): Promise<ActionResult<{ token: string | null }>> {
  const user = await requireUser();
  const plan = await ownPlan(user.id, planId);
  if (!plan) return { ok: false, error: "Plan not found" };
  const token =
    visibility === "link" ? (plan.shareToken ?? newToken()) : plan.shareToken;
  await db
    .update(prepPlans)
    .set({ visibility, shareToken: token })
    .where(eq(prepPlans.id, planId));
  refresh();
  return { ok: true, data: { token: visibility === "link" ? token : null } };
}

/** New link; the old one stops working at once. */
export async function regenerateShareLink(
  planId: string,
): Promise<ActionResult<{ token: string }>> {
  const user = await requireUser();
  if (!(await ownPlan(user.id, planId)))
    return { ok: false, error: "Plan not found" };
  const token = newToken();
  await db
    .update(prepPlans)
    .set({ shareToken: token })
    .where(eq(prepPlans.id, planId));
  refresh();
  return { ok: true, data: { token } };
}

const STATES = ["done", "confident", "revise"] as const;

/** Records the viewer's own progress. Owners always; others only on link-shared plans. */
export async function setProgress(
  planId: string,
  questionId: string,
  state: (typeof STATES)[number] | null,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to track your progress." };
  const s = z.enum(STATES).nullable().safeParse(state);
  if (!s.success) return { ok: false, error: "Invalid state" };

  const plan = await db.query.prepPlans.findFirst({
    where: eq(prepPlans.id, planId),
  });
  if (!plan || (plan.userId !== user.id && plan.visibility !== "link"))
    return { ok: false, error: "Plan not found" };
  const inPlan = await db.query.prepPlanItems.findFirst({
    where: and(
      eq(prepPlanItems.planId, planId),
      eq(prepPlanItems.questionId, questionId),
    ),
  });
  if (!inPlan) return { ok: false, error: "Question not in this plan" };

  if (s.data === null) {
    await db
      .delete(prepProgress)
      .where(
        and(
          eq(prepProgress.userId, user.id),
          eq(prepProgress.planId, planId),
          eq(prepProgress.questionId, questionId),
        ),
      );
  } else {
    await db
      .insert(prepProgress)
      .values({ userId: user.id, planId, questionId, state: s.data })
      .onConflictDoUpdate({
        target: [
          prepProgress.userId,
          prepProgress.planId,
          prepProgress.questionId,
        ],
        set: { state: s.data },
      });
  }
  return { ok: true, data: undefined };
}

/** Admin: import a JSON or CSV question file into the bank. */
export async function importQuestionFile(form: FormData): Promise<
  ActionResult<{
    imported: number;
    total: number;
    skipped: { row: number; reason: string }[];
  }>
> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose a .json or .csv file" };
  if (file.size > 5 * 1024 * 1024)
    return { ok: false, error: "Files up to 5 MB" };
  try {
    const result = parseQuestionFile(file.name, await file.text(), {
      name: String(form.get("name") ?? ""),
      url: String(form.get("url") ?? ""),
      license: String(form.get("license") ?? ""),
    });
    if (result.questions.length === 0)
      return { ok: false, error: "No valid questions found in that file" };
    const out = await writeImport(db, result);
    refresh();
    return {
      ok: true,
      data: {
        imported: out.imported,
        total: out.total,
        skipped: result.skipped.slice(0, 20),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Import failed",
    };
  }
}
