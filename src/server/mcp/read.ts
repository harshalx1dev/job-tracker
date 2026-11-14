import "server-only";
import {
  and,
  arrayContains,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/server/db";
import {
  answers,
  jobs,
  outreachMessages,
  resumes,
  statuses,
} from "@/server/db/schema";
import { getProfile } from "@/server/profile/queries";
import { getBackground } from "@/server/profile/question-queries";
import { getPreferences } from "@/server/profile/preferences";
import { getJob, listApplications } from "@/server/jobs/queries";
import { listStatuses } from "@/server/jobs/statuses";

/*
 * Data the Claude connector reads. Every function takes the token owner's
 * userId and filters by it; no tool input can name another user's data.
 */

/** A search term as a LIKE pattern, with the wildcard characters made literal. */
const like = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

export async function readProfile(userId: string) {
  const [{ profile, saved }, background, jobSearchPreferences] =
    await Promise.all([
      getProfile(userId),
      getBackground(userId),
      getPreferences(userId),
    ]);
  return {
    saved,
    profile,
    /** What the user wants from a search: roles, places, pay, what to skip, jobs per session. */
    jobSearchPreferences,
    /** Answers the user gave to "Questions for you", newest first. */
    background,
  };
}

export async function readStatuses(userId: string) {
  return (await listStatuses(userId)).map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
  }));
}

export async function readAnswers(
  userId: string,
  opts: { query?: string; tag?: string; limit?: number } = {},
) {
  const rows = await db
    .select({
      id: answers.id,
      question: answers.question,
      answer: answers.answer,
      tags: answers.tags,
      jobId: answers.jobId,
      wordLimit: answers.wordLimit,
      updatedAt: answers.updatedAt,
    })
    .from(answers)
    .where(
      and(
        eq(answers.userId, userId),
        opts.query
          ? or(
              ilike(answers.question, like(opts.query)),
              ilike(answers.answer, like(opts.query)),
            )
          : undefined,
        opts.tag ? arrayContains(answers.tags, [opts.tag]) : undefined,
      ),
    )
    .orderBy(desc(answers.updatedAt))
    .limit(Math.min(opts.limit ?? 25, 50));
  return rows;
}

export async function readJobs(
  userId: string,
  opts: { status?: string; query?: string; limit?: number } = {},
) {
  const rows = await db
    .select({
      id: jobs.id,
      company: jobs.company,
      title: jobs.title,
      status: statuses.name,
      location: jobs.location,
      workMode: jobs.workMode,
      url: jobs.url,
      source: jobs.source,
      priority: jobs.priority,
      appliedAt: jobs.appliedAt,
      interviewAt: jobs.interviewAt,
      match: jobs.match,
      claudeMatch: jobs.claudeMatch,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .innerJoin(statuses, eq(statuses.id, jobs.statusId))
    .where(
      and(
        eq(jobs.userId, userId),
        isNull(jobs.archivedAt),
        opts.status
          ? sql`lower(${statuses.name}) = ${opts.status.toLowerCase()}`
          : undefined,
        opts.query
          ? or(
              ilike(jobs.company, like(opts.query)),
              ilike(jobs.title, like(opts.query)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(jobs.updatedAt))
    .limit(Math.min(opts.limit ?? 25, 50));

  // Scores only, no assessments: get_job has the full detail.
  return rows.map(({ match, claudeMatch, ...job }) => ({
    ...job,
    trackrScore: match?.score ?? null,
    claudeScore: claudeMatch?.score ?? null,
  }));
}

export async function readJob(userId: string, jobId: string) {
  const job = await getJob(userId, jobId);
  if (!job) return null;
  const [linkedResumes, drafts, linkedAnswers, applications] =
    await Promise.all([
      db
        .select({
          id: resumes.id,
          title: resumes.title,
          updatedAt: resumes.updatedAt,
        })
        .from(resumes)
        .where(and(eq(resumes.jobId, jobId), eq(resumes.userId, userId)))
        .orderBy(desc(resumes.updatedAt)),
      db
        .select({
          id: outreachMessages.id,
          channel: outreachMessages.channel,
          tone: outreachMessages.tone,
          recipientName: outreachMessages.recipientName,
          subject: outreachMessages.subject,
          body: outreachMessages.body,
          createdAt: outreachMessages.createdAt,
        })
        .from(outreachMessages)
        .where(
          and(
            eq(outreachMessages.jobId, jobId),
            eq(outreachMessages.userId, userId),
          ),
        )
        .orderBy(desc(outreachMessages.createdAt)),
      db
        .select({
          id: answers.id,
          question: answers.question,
          answer: answers.answer,
          tags: answers.tags,
        })
        .from(answers)
        .where(and(eq(answers.jobId, jobId), eq(answers.userId, userId))),
      listApplications(userId, jobId),
    ]);

  return {
    id: job.id,
    company: job.company,
    title: job.title,
    status: { id: job.status.id, name: job.status.name, kind: job.status.kind },
    location: job.location,
    workMode: job.workMode,
    url: job.url,
    source: job.source,
    priority: job.priority,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    skills: job.skills,
    description: job.description,
    notes: job.notes,
    appliedAt: job.appliedAt,
    interviewAt: job.interviewAt,
    /** The match Trackr's own AI produced, if any. */
    trackrMatch: job.match,
    /** The assessment Claude saved, if any. */
    claudeMatch: job.claudeMatch,
    contacts: job.contacts.map((c) => ({
      name: c.name,
      role: c.role,
      email: c.email,
      linkedinUrl: c.linkedinUrl,
      notes: c.notes,
    })),
    recentHistory: job.events
      .slice(0, 10)
      .map((e) => ({ type: e.type, at: e.createdAt })),
    resumes: linkedResumes,
    outreachDrafts: drafts,
    answers: linkedAnswers,
    /** Earlier attempts to apply, with everything that was submitted. */
    applications,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function readResume(userId: string, resumeId: string) {
  const row = await db.query.resumes.findFirst({
    where: and(eq(resumes.id, resumeId), eq(resumes.userId, userId)),
    columns: {
      id: true,
      title: true,
      jobId: true,
      content: true,
      updatedAt: true,
    },
  });
  return row ?? null;
}
