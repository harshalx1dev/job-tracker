import "server-only";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { outreachSaveSchema } from "@/lib/outreach";
import type { McpAuth } from "./tokens";
import { tool } from "./tool";
import { applicationInputSchema } from "@/lib/application-summary";
import {
  addJob,
  answerAddSchema,
  claudeMatchSchema,
  emailSummary,
  logApplication,
  patchJob,
  saveAnswerEntry,
  saveOutreachDraft,
  saveResumeVersion,
} from "./write";

const id = z.string().min(1).max(100);
const bullets = z.array(z.string().min(1).max(400)).max(40);

/**
 * Tools that add data. They all need the "write" scope, and none of them edits
 * or deletes anything the user already has.
 */
export function registerWriteTools(server: McpServer, auth: McpAuth) {
  tool(
    server,
    auth,
    {
      name: "create_job",
      title: "Add a job to the board",
      description:
        "Adds a job lead to the user's Kanban board (first open stage unless you pass one). Include the posting text in description, the URL, and your fit assessment in match. If the same URL or company and title is already tracked, nothing is added and the existing job is returned. Your match is stored as Claude's own assessment, apart from Trackr's AI score.",
      scope: "write",
      input: {
        company: z.string().min(1).max(120),
        title: z.string().min(1).max(160),
        url: z.string().max(2000).optional(),
        description: z
          .string()
          .max(20_000)
          .optional()
          .describe("The job posting text"),
        location: z.string().max(120).optional(),
        workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
        salaryMin: z.number().int().nonnegative().optional(),
        salaryMax: z.number().int().nonnegative().optional(),
        currency: z.string().max(8).optional().describe("ISO code, e.g. INR"),
        skills: z.array(z.string().min(1).max(40)).max(40).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        notes: z.string().max(10_000).optional(),
        status: z
          .string()
          .max(60)
          .optional()
          .describe(
            "Stage name from list_statuses; defaults to the first open stage",
          ),
        match: claudeMatchSchema.optional(),
        force: z
          .boolean()
          .optional()
          .describe("Add even if a similar job is already tracked"),
      },
    },
    (args, userId) => addJob(userId, args),
  );

  tool(
    server,
    auth,
    {
      name: "update_job",
      title: "Update a job",
      description:
        "Limited updates to a tracked job: append a dated note, move it to another stage, attach your match assessment, or fill in a missing description. It never replaces existing notes or an existing description.",
      scope: "write",
      input: {
        jobId: id,
        appendNote: z.string().max(2000).optional(),
        status: z
          .string()
          .max(60)
          .optional()
          .describe("Stage name from list_statuses"),
        match: claudeMatchSchema.optional(),
        description: z
          .string()
          .max(20_000)
          .optional()
          .describe("Only accepted if the job has no description yet"),
      },
    },
    (args, userId) => patchJob(userId, args),
  );

  tool(
    server,
    auth,
    {
      name: "save_resume_version",
      title: "Save a tailored resume version",
      description:
        "Creates a NEW resume (a copy of an existing resume, or of the profile) with improved wording, so the user can review it and export the PDF in Trackr. The original is never changed. You may only reword: summary, an experience role's highlights, a project's description or highlights. Companies, titles, dates and links cannot change, and you must not add facts that are not in the profile. Highlights may use **bold**, *italic*, [text](url), and a line starting with '## ' is a sub-heading for the bullets after it. To change a role's bullets, send the full new list for that role.",
      scope: "write",
      input: {
        basedOnResumeId: id
          .optional()
          .describe("Resume to copy; defaults to the profile"),
        jobId: id.optional().describe("Job this version is for"),
        title: z.string().max(120).optional(),
        summary: z.string().max(2000).optional(),
        experience: z
          .array(
            z.object({
              company: z.string().min(1).max(120),
              title: z
                .string()
                .max(120)
                .optional()
                .describe(
                  "Needed only if there are several roles at the company",
                ),
              highlights: bullets,
            }),
          )
          .max(20)
          .optional(),
        projects: z
          .array(
            z.object({
              name: z.string().min(1).max(120),
              description: z.string().max(600).optional(),
              highlights: bullets.optional(),
            }),
          )
          .max(20)
          .optional(),
      },
    },
    (args, userId) => saveResumeVersion(userId, args),
  );

  tool(
    server,
    auth,
    {
      name: "save_outreach_draft",
      title: "Save an outreach draft",
      description:
        "Saves a new outreach message draft (email or LinkedIn note) for the user to review in Trackr, optionally linked to a job. Adds a new draft; never edits an existing one.",
      scope: "write",
      input: outreachSaveSchema.shape,
    },
    (args, userId) => saveOutreachDraft(userId, args),
  );

  tool(
    server,
    auth,
    {
      name: "log_application",
      title: "Record an application attempt",
      description:
        "Records one attempt to apply to a tracked job: where, the outcome, the resume used, and every field and value (submitted: [{field, value}]). Use outcome 'prepared' when you only read the application form and drafted answers for the user to copy and submit themselves: list each question or field with your proposed answer, and for any you have no fact for set missing: true and leave value empty (never guess, e.g. current salary, custom essays); put the apply link in url and name the resume to attach in notes. Use 'applied' only if you really submitted it. For a failure, set failureReason. NEVER include passwords, one-time codes or site login details. Check get_job first: it lists earlier attempts, so you do not apply twice. This does not move the job: call update_job to move it to Applied. Adds a record; never edits one.",
      scope: "write",
      input: applicationInputSchema.shape,
    },
    (args, userId) => logApplication(userId, args),
  );

  tool(
    server,
    auth,
    {
      name: "email_me_summary",
      title: "Email the user a summary",
      description:
        "Emails the signed-in user (always their own address) a summary of the attempts you recorded with log_application: what was applied to, what could not be applied to and why, each with a Trackr link. Pass the application ids from this session. Trackr writes the email from its own records; you may add a short intro. At most 5 a day.",
      scope: "write",
      input: {
        applicationIds: z.array(id).min(1).max(50),
        intro: z.string().max(500).optional(),
      },
    },
    (args, userId) => emailSummary(userId, args),
  );

  tool(
    server,
    auth,
    {
      name: "save_answer",
      title: "Save an answer to the answer bank",
      description:
        "Saves a new answer to an application question in the user's answer bank. Use only facts from the user's profile. Adds a new entry; never edits an existing one.",
      scope: "write",
      input: answerAddSchema.shape,
    },
    (args, userId) => saveAnswerEntry(userId, args),
  );
}
