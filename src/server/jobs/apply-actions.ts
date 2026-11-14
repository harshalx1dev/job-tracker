"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { submittedFieldSchema } from "@/lib/application-summary";
import { isMissing } from "@/lib/apply-readiness";
import { db } from "@/server/db";
import { jobApplications, jobs } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import type { ActionResult } from "./actions";

/** The "Apply with AI" tick on a job. Claude only acts on ticked jobs that are also ready. */
export async function setApplyWithAi(
  jobId: string,
  on: boolean,
): Promise<ActionResult> {
  const user = await requireUser();
  const res = await db
    .update(jobs)
    .set({ applyWithAi: on, updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
    .returning({ id: jobs.id });
  if (!res.length) return { ok: false, error: "Job not found" };
  refresh();
  return { ok: true, data: undefined };
}

const fieldsSchema = z.array(submittedFieldSchema).max(60);

/**
 * The user fills in or corrects the answers Claude prepared. Only drafts can be
 * edited: a record of what was actually submitted is never rewritten.
 */
export async function savePreparedFields(
  applicationId: string,
  fields: unknown,
): Promise<
  ActionResult<{
    submitted: { field: string; value: string; missing?: boolean }[];
  }>
> {
  const user = await requireUser();
  const parsed = fieldsSchema.safeParse(fields);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid answers",
    };

  const submitted = parsed.data.map((f) => ({
    field: f.field,
    value: f.value,
    ...(isMissing({ ...f, missing: undefined }) ? { missing: true } : {}),
  }));
  const res = await db
    .update(jobApplications)
    .set({ submitted })
    .where(
      and(
        eq(jobApplications.id, applicationId),
        eq(jobApplications.userId, user.id),
        eq(jobApplications.outcome, "prepared"),
      ),
    )
    .returning({ id: jobApplications.id });
  if (!res.length)
    return { ok: false, error: "Only prepared answers can be edited" };
  return { ok: true, data: { submitted } };
}
