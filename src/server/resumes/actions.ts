"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { jobs, resumes } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { profileSchema } from "@/lib/profile";
import { defaultDesign, designSchema } from "@/lib/resume";
import { getProfile } from "@/server/profile/queries";
import type { ActionResult } from "@/server/jobs/actions";

async function own(userId: string, id: string) {
  return db.query.resumes.findFirst({
    where: and(eq(resumes.id, id), eq(resumes.userId, userId)),
  });
}

/** A new resume starts as a copy of the profile; it's edited independently after that. */
export async function createResume(input: {
  jobId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const { profile } = await getProfile(user.id);

  let title = profile.basics.headline
    ? `${profile.basics.headline} resume`
    : "My resume";
  let jobId: string | null = null;
  if (input.jobId) {
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, input.jobId), eq(jobs.userId, user.id)),
      columns: { id: true, company: true, title: true },
    });
    if (!job) return { ok: false, error: "Job not found" };
    jobId = job.id;
    title = `${job.company} · ${job.title}`;
  }

  const [row] = await db
    .insert(resumes)
    .values({
      userId: user.id,
      jobId,
      title: title.slice(0, 120),
      content: profile,
      design: defaultDesign(),
    })
    .returning({ id: resumes.id });
  refresh();
  return { ok: true, data: { id: row.id } };
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: profileSchema.optional(),
  design: designSchema.optional(),
});

/** Autosave target: any of title, content, design. */
export async function updateResume(
  id: string,
  patch: z.input<typeof patchSchema>,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid resume",
    };
  if (!(await own(user.id, id)))
    return { ok: false, error: "Resume not found" };
  await db
    .update(resumes)
    .set(parsed.data)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)));
  return { ok: true, data: undefined };
}

/** Replaces this resume's content with the current profile (design is kept). */
export async function syncResumeFromProfile(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await own(user.id, id)))
    return { ok: false, error: "Resume not found" };
  const { profile } = await getProfile(user.id);
  await db.update(resumes).set({ content: profile }).where(eq(resumes.id, id));
  refresh();
  return { ok: true, data: undefined };
}

export async function duplicateResume(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const src = await own(user.id, id);
  if (!src) return { ok: false, error: "Resume not found" };
  const [row] = await db
    .insert(resumes)
    .values({
      userId: user.id,
      jobId: src.jobId,
      title: `${src.title} (copy)`.slice(0, 120),
      content: src.content,
      design: src.design,
    })
    .returning({ id: resumes.id });
  refresh();
  return { ok: true, data: { id: row.id } };
}

export async function deleteResume(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await db
    .delete(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)));
  refresh();
  return { ok: true, data: undefined };
}
