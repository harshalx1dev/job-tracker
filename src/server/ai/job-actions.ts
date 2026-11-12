"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { jobs } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import type { JobImport, JobMatch } from "@/lib/ai-schemas";
import { sectionSize } from "@/lib/profile";
import { getProfile } from "@/server/profile/queries";
import { getBackground } from "@/server/profile/question-queries";
import { AiError, toAiError, type AiResult } from "./errors";
import { importJob, matchJob } from "./features";

/** Pasted job description → fields for the job form (nothing is saved here). */
export async function aiImportJob(
  description: string,
): Promise<AiResult<JobImport>> {
  const user = await requireUser();
  const text = z.string().max(40_000).safeParse(description);
  if (!text.success)
    return {
      ok: false,
      code: "TOO_LARGE",
      error: "That description is too long.",
    };
  try {
    return { ok: true, data: await importJob(user, text.data) };
  } catch (err) {
    const e = toAiError(err);
    return { ok: false, code: e.code, error: e.message };
  }
}

/** Scores the profile against a job and stores the result on the job. */
export async function aiMatchJob(jobId: string): Promise<AiResult<JobMatch>> {
  const user = await requireUser();
  try {
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.userId, user.id)),
      columns: { company: true, title: true, description: true, skills: true },
    });
    if (!job) throw new AiError("FAILED", "Job not found.");

    const { profile, saved } = await getProfile(user.id);
    if (
      !saved ||
      sectionSize(profile, "experience") + sectionSize(profile, "skills") === 0
    ) {
      throw new AiError(
        "BAD_OUTPUT",
        "Add your experience or skills to your profile first (or upload your resume).",
      );
    }
    const background = await getBackground(user.id);
    const result = await matchJob(user, { ...profile, background }, job);
    const match: JobMatch = { ...result, at: new Date().toISOString() };
    await db
      .update(jobs)
      .set({ match })
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)));
    refresh();
    return { ok: true, data: match };
  } catch (err) {
    const e = toAiError(err);
    return { ok: false, code: e.code, error: e.message };
  }
}
