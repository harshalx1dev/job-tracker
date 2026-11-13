import "server-only";
import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { z } from "zod";
import { db } from "@/server/db";
import {
  answers,
  jobApplications,
  jobEvents,
  jobs,
  mcpCalls,
  mcpTokens,
  outreachMessages,
  resumes,
  statuses,
  user,
} from "@/server/db/schema";
import {
  applicationInputSchema,
  buildApplicationSummary,
} from "@/lib/application-summary";
import { sendEmail } from "@/server/email";
import type { JobMatch } from "@/lib/ai-schemas";
import { answerSaveSchema } from "@/lib/answers";
import { outreachSaveSchema } from "@/lib/outreach";
import { profileSchema, type Profile } from "@/lib/profile";
import { defaultDesign } from "@/lib/resume";
import {
  applyWording,
  WordingError,
  type WordingPatch,
} from "@/lib/resume-wording";
import { jobInputSchema } from "@/lib/validators/job";
import { insertJob, lastPositionIn } from "@/server/jobs/service";
import { listStatuses } from "@/server/jobs/statuses";
import { getProfile } from "@/server/profile/queries";
import { ToolError } from "./tool";

/*
 * What the Claude connector may write. Everything here only ADDS: new jobs,
 * resume versions (a copy, never the original), drafts and answers, plus
 * limited updates to a job. Nothing deletes or archives, and nothing edits the
 * profile or anything the user already wrote. Every function takes the token
 * owner's userId and checks ownership of anything it is pointed at.
 */

const appLink = (path: string) =>
  `${(process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "")}${path}`;

const issues = (err: z.ZodError) =>
  err.issues
    .map((i) => `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`)
    .join("; ");

/** Claude's own assessment of a job. Stored apart from Trackr's AI match. */
export const claudeMatchSchema = z.object({
  score: z.number().int().min(0).max(100).describe("Overall fit, 0 to 100"),
  verdict: z.string().max(200).describe("One plain sentence"),
  matched: z.array(z.string().max(60)).max(15).default([]),
  missing: z.array(z.string().max(60)).max(15).default([]),
  suggestions: z.array(z.string().max(240)).max(5).default([]),
});
export type ClaudeMatchInput = z.input<typeof claudeMatchSchema>;

const toMatch = (m: ClaudeMatchInput): JobMatch => ({
  ...claudeMatchSchema.parse(m),
  at: new Date().toISOString(),
});

async function resolveStage(userId: string, name?: string) {
  const all = await listStatuses(userId);
  if (!name) return all.find((s) => s.kind === "open") ?? all[0];
  const hit = all.find(
    (s) => s.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (!hit)
    throw new ToolError(
      `No stage named "${name}". The stages are: ${all.map((s) => s.name).join(", ")}.`,
    );
  return hit;
}

async function assertOwnJob(userId: string, jobId: string) {
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)),
    columns: { id: true, company: true, title: true },
  });
  if (!job) throw new ToolError("Job not found.");
  return job;
}

/* ---------------------------------- jobs --------------------------------- */

export type AddJobInput = Record<string, unknown> & {
  status?: string;
  match?: ClaudeMatchInput;
  force?: boolean;
};

export async function addJob(userId: string, input: AddJobInput) {
  const { status, match, force, ...fields } = input;
  const stage = await resolveStage(userId, status);
  const parsed = jobInputSchema.safeParse({
    ...fields,
    source: (fields.source as string | undefined) || "Claude",
    statusId: stage.id,
  });
  if (!parsed.success) throw new ToolError(issues(parsed.error));

  if (!force) {
    const same = and(
      sql`lower(${jobs.company}) = ${parsed.data.company.toLowerCase()}`,
      sql`lower(${jobs.title}) = ${parsed.data.title.toLowerCase()}`,
    );
    const url = parsed.data.url?.replace(/\/+$/, "");
    const [dup] = await db
      .select({
        id: jobs.id,
        company: jobs.company,
        title: jobs.title,
        stage: statuses.name,
      })
      .from(jobs)
      .innerJoin(statuses, eq(statuses.id, jobs.statusId))
      .where(
        and(
          eq(jobs.userId, userId),
          isNull(jobs.archivedAt),
          url ? or(same, sql`rtrim(${jobs.url}, '/') = ${url}`) : same,
        ),
      )
      .limit(1);
    if (dup)
      return {
        created: false,
        reason:
          "A job with the same URL or the same company and title is already on the board. Nothing was added. Use update_job to change it, or pass force: true to add it anyway.",
        existing: { ...dup, link: appLink(`/app/jobs?job=${dup.id}`) },
      };
  }

  const row = await insertJob(userId, parsed.data, {
    claudeMatch: match ? toMatch(match) : undefined,
    eventPayload: { via: "claude" },
  });
  return {
    created: true,
    id: row.id,
    stage: stage.name,
    link: appLink(`/app/jobs?job=${row.id}`),
  };
}

export async function patchJob(
  userId: string,
  input: {
    jobId: string;
    appendNote?: string;
    status?: string;
    match?: ClaudeMatchInput;
    description?: string;
  },
) {
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, input.jobId), eq(jobs.userId, userId)),
  });
  if (!job) throw new ToolError("Job not found.");

  const set: Partial<typeof jobs.$inferInsert> = {};
  const changed: string[] = [];

  if (input.appendNote?.trim()) {
    const stamp = new Date().toISOString().slice(0, 10);
    const notes = [job.notes, `[Claude ${stamp}] ${input.appendNote.trim()}`]
      .filter(Boolean)
      .join("\n\n");
    if (notes.length > 10_000)
      throw new ToolError("The notes would pass 10,000 characters.");
    set.notes = notes;
    changed.push("notes");
  }
  if (input.description?.trim()) {
    // Never replace text the user (or an import) already put there.
    if (job.description?.trim())
      throw new ToolError(
        "This job already has a description. Add to the notes instead.",
      );
    set.description = input.description.trim();
    changed.push("description");
  }
  if (input.match) {
    set.claudeMatch = toMatch(input.match);
    changed.push("claudeMatch");
  }
  let moved: { from: string; to: string } | null = null;
  if (input.status) {
    const stage = await resolveStage(userId, input.status);
    if (stage.id !== job.statusId) {
      set.statusId = stage.id;
      set.position = generateKeyBetween(
        await lastPositionIn(userId, stage.id),
        null,
      );
      moved = { from: job.statusId, to: stage.id };
      changed.push("stage");
    }
  }
  if (!changed.length) throw new ToolError("Nothing to change.");

  await db
    .update(jobs)
    .set(set)
    .where(and(eq(jobs.id, job.id), eq(jobs.userId, userId)));
  await db.insert(jobEvents).values(
    moved
      ? {
          jobId: job.id,
          userId,
          type: "status_changed" as const,
          fromStatusId: moved.from,
          toStatusId: moved.to,
          payload: { via: "claude" },
        }
      : {
          jobId: job.id,
          userId,
          type: "updated" as const,
          payload: { via: "claude", fields: changed },
        },
  );
  return { updated: changed, link: appLink(`/app/jobs?job=${job.id}`) };
}

/* --------------------------------- resumes -------------------------------- */

export type ResumeVersionInput = {
  basedOnResumeId?: string;
  jobId?: string;
  title?: string;
  summary?: string;
  experience?: { company: string; title?: string; highlights: string[] }[];
  projects?: { name: string; description?: string; highlights?: string[] }[];
};

/** The wording rules live in lib (pure and tested); here a bad patch becomes a message for Claude. */
function wordingFor(content: Profile, patch: WordingPatch): Profile {
  try {
    return applyWording(content, patch);
  } catch (err) {
    if (err instanceof WordingError) throw new ToolError(err.message);
    throw err;
  }
}

/** Saves a NEW resume from a copy (the base resume, or the profile). The original is never touched. */
export async function saveResumeVersion(
  userId: string,
  input: ResumeVersionInput,
) {
  let content: Profile;
  let design = defaultDesign();
  let jobId: string | null = input.jobId ?? null;
  let baseTitle = "";

  if (input.basedOnResumeId) {
    const base = await db.query.resumes.findFirst({
      where: and(
        eq(resumes.id, input.basedOnResumeId),
        eq(resumes.userId, userId),
      ),
    });
    if (!base) throw new ToolError("Resume not found.");
    content = base.content;
    design = base.design;
    baseTitle = base.title;
    jobId ??= base.jobId;
  } else {
    content = (await getProfile(userId)).profile;
  }

  let jobLabel = "";
  if (jobId) {
    const job = await assertOwnJob(userId, jobId);
    jobLabel = `${job.company} · ${job.title}`;
  }

  const updated = wordingFor(content, input);
  const valid = profileSchema.safeParse(updated);
  if (!valid.success) throw new ToolError(issues(valid.error));

  const title = (
    input.title?.trim() || `${jobLabel || baseTitle || "My resume"} (Claude)`
  ).slice(0, 120);
  const [row] = await db
    .insert(resumes)
    .values({ userId, jobId, title, content: valid.data, design })
    .returning({ id: resumes.id });
  return { id: row.id, title, link: appLink(`/app/resumes/${row.id}`) };
}

/* ------------------------------- applications ------------------------------ */

/** Records what was submitted for one attempt. Adds a row; never edits one. */
export async function logApplication(userId: string, input: unknown) {
  const parsed = applicationInputSchema.safeParse(input);
  if (!parsed.success) throw new ToolError(issues(parsed.error));
  const a = parsed.data;
  const job = await assertOwnJob(userId, a.jobId);
  if (a.outcome === "failed" && !a.failureReason?.trim())
    throw new ToolError("Say why it failed in failureReason.");

  let resumeTitle: string | null = null;
  if (a.resumeId) {
    const resume = await db.query.resumes.findFirst({
      where: and(eq(resumes.id, a.resumeId), eq(resumes.userId, userId)),
      columns: { title: true },
    });
    if (!resume) throw new ToolError("Resume not found.");
    resumeTitle = resume.title;
  }

  const [already] =
    a.outcome === "applied"
      ? await db
          .select({ id: jobApplications.id })
          .from(jobApplications)
          .where(
            and(
              eq(jobApplications.jobId, job.id),
              eq(jobApplications.userId, userId),
              eq(jobApplications.outcome, "applied"),
            ),
          )
          .limit(1)
      : [];

  const [row] = await db
    .insert(jobApplications)
    .values({
      userId,
      jobId: job.id,
      platform: a.platform,
      outcome: a.outcome,
      url: a.url ?? null,
      resumeId: a.resumeId ?? null,
      resumeTitle,
      submitted: a.submitted,
      failureReason: a.failureReason?.trim() || null,
      notes: a.notes?.trim() || null,
    })
    .returning({ id: jobApplications.id });
  await db.insert(jobEvents).values({
    jobId: job.id,
    userId,
    type: "updated",
    payload: {
      via: "claude",
      application: a.outcome,
      applicationId: row.id,
    },
  });
  return {
    id: row.id,
    link: appLink(`/app/jobs?job=${job.id}`),
    ...(already
      ? {
          warning:
            "This job already had an applied record. Check you did not apply twice.",
        }
      : {}),
    reminder:
      a.outcome === "applied"
        ? "The stage was not changed. Use update_job to move the job to Applied."
        : a.outcome === "prepared"
          ? "Saved for the user to copy from Trackr. Do not submit this application."
          : undefined,
  };
}

const MAX_SUMMARY_EMAILS_PER_DAY = 5;

/** Emails a summary to the token owner's own address. The recipient is never an input. */
export async function emailSummary(
  userId: string,
  input: { applicationIds: string[]; intro?: string },
) {
  const [sent] = await db
    .select({ n: count() })
    .from(mcpCalls)
    .innerJoin(mcpTokens, eq(mcpTokens.id, mcpCalls.tokenId))
    .where(
      and(
        eq(mcpTokens.userId, userId),
        eq(mcpCalls.tool, "email_me_summary"),
        eq(mcpCalls.ok, true),
        gte(mcpCalls.createdAt, new Date(Date.now() - 86_400_000)),
      ),
    );
  if (sent.n >= MAX_SUMMARY_EMAILS_PER_DAY)
    throw new ToolError(
      `At most ${MAX_SUMMARY_EMAILS_PER_DAY} summary emails a day. Try again tomorrow.`,
    );

  const rows = await db
    .select({
      outcome: jobApplications.outcome,
      platform: jobApplications.platform,
      failureReason: jobApplications.failureReason,
      jobId: jobs.id,
      company: jobs.company,
      title: jobs.title,
      location: jobs.location,
      workMode: jobs.workMode,
      description: jobs.description,
    })
    .from(jobApplications)
    .innerJoin(jobs, eq(jobs.id, jobApplications.jobId))
    .where(
      and(
        eq(jobApplications.userId, userId),
        inArray(jobApplications.id, input.applicationIds),
      ),
    )
    .orderBy(asc(jobApplications.createdAt));
  if (!rows.length)
    throw new ToolError("None of those application ids were found.");

  const me = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { email: true },
  });
  if (!me) throw new ToolError("User not found.");

  const { subject, text } = buildApplicationSummary({
    intro: input.intro,
    items: rows.map((r) => ({
      ...r,
      link: appLink(`/app/jobs?job=${r.jobId}`),
    })),
  });
  const delivered = await sendEmail({
    to: me.email,
    subject,
    text,
    link: appLink("/app/jobs"),
  });
  if (!delivered)
    throw new ToolError(
      "The email was not sent: email is not configured on this Trackr server (or the address can't receive mail). Tell the user.",
    );
  return { sent: true, jobs: rows.length };
}

/* ------------------------------ drafts, answers ---------------------------- */

export async function saveOutreachDraft(userId: string, input: unknown) {
  const parsed = outreachSaveSchema.safeParse(input);
  if (!parsed.success) throw new ToolError(issues(parsed.error));
  if (parsed.data.jobId) await assertOwnJob(userId, parsed.data.jobId);
  const [row] = await db
    .insert(outreachMessages)
    .values({
      ...parsed.data,
      jobId: parsed.data.jobId || null,
      userId,
    })
    .returning({ id: outreachMessages.id });
  return { id: row.id, link: appLink("/app/outreach") };
}

/** No `id` is accepted: this can only add an entry, never overwrite one. */
export const answerAddSchema = answerSaveSchema.omit({ id: true });

export async function saveAnswerEntry(userId: string, input: unknown) {
  const parsed = answerAddSchema.safeParse(input);
  if (!parsed.success) throw new ToolError(issues(parsed.error));
  const a = parsed.data;
  if (a.jobId) await assertOwnJob(userId, a.jobId);
  const [row] = await db
    .insert(answers)
    .values({
      question: a.question,
      answer: a.answer,
      tags: a.tags,
      jobId: a.jobId || null,
      wordLimit: a.wordLimit ?? null,
      userId,
    })
    .returning({ id: answers.id });
  return {
    id: row.id,
    // No embedding: it would call the user's Gemini key. Saving it once in Trackr adds it.
    searchableByFindSimilar: false,
    link: appLink("/app/answers"),
  };
}
