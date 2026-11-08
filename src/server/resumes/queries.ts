import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { jobs, resumes } from "@/server/db/schema";

export async function listResumes(userId: string) {
  return db
    .select({
      id: resumes.id,
      title: resumes.title,
      content: resumes.content,
      design: resumes.design,
      updatedAt: resumes.updatedAt,
      jobId: resumes.jobId,
      jobCompany: jobs.company,
      jobTitle: jobs.title,
    })
    .from(resumes)
    .leftJoin(jobs, eq(jobs.id, resumes.jobId))
    .where(eq(resumes.userId, userId))
    .orderBy(desc(resumes.updatedAt));
}

export async function getResume(userId: string, id: string) {
  const [row] = await db
    .select({
      resume: resumes,
      jobCompany: jobs.company,
      jobTitle: jobs.title,
      jobMatch: jobs.match,
    })
    .from(resumes)
    .leftJoin(jobs, eq(jobs.id, resumes.jobId))
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)));
  return row ?? null;
}

/** For the print route: looked up by id only, after its signed token is verified. */
export async function getResumeForPrint(id: string) {
  return (
    (await db.query.resumes.findFirst({ where: eq(resumes.id, id) })) ?? null
  );
}

export type ResumeListItem = Awaited<ReturnType<typeof listResumes>>[number];
