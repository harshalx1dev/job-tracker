import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { jobs } from "@/server/db/schema";
import { sectionSize } from "@/lib/profile";
import { getProfile } from "@/server/profile/queries";
import { AiError } from "./errors";

/** The profile every writing feature needs; fails early with a useful message. */
export async function requireProfile(userId: string) {
  const { profile, saved } = await getProfile(userId);
  const filled =
    sectionSize(profile, "experience") +
    sectionSize(profile, "skills") +
    sectionSize(profile, "summary");
  if (!saved || filled === 0) {
    throw new AiError(
      "BAD_OUTPUT",
      "Fill your profile first (upload your resume on the Profile page).",
    );
  }
  return profile;
}

export async function jobContext(userId: string, jobId?: string | null) {
  if (!jobId) return null;
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)),
    columns: { company: true, title: true, description: true, skills: true },
  });
  if (!job) throw new AiError("FAILED", "Job not found.");
  return job;
}
