import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpAuth } from "./tokens";
import * as read from "./read";
import { ToolError, tool } from "./tool";
import { registerWriteTools } from "./write-tools";

const id = z.string().min(1).max(100);
const limit = z.number().int().min(1).max(50).optional();

/** A server for one request, bound to the token's owner. */
export function createTrackrServer(auth: McpAuth) {
  const server = new McpServer({ name: "trackr", version: "1.0.0" });

  tool(
    server,
    auth,
    {
      name: "get_profile",
      title: "Get my profile",
      description:
        "The user's profile (from their resume), the answers they gave to Trackr's 'Questions for you', and their job search preferences (jobSearchPreferences: target roles, locations, work modes, pay, what to skip, and the most jobs to handle per session). This is the only source of truth about their experience: never invent roles, dates, metrics or skills that are not here. When searching for jobs, follow jobSearchPreferences and stop at maxPerSession.",
      scope: "read",
      input: {},
    },
    (_args, userId) => read.readProfile(userId),
  );

  tool(
    server,
    auth,
    {
      name: "list_statuses",
      title: "List board stages",
      description:
        "The user's Kanban stages (for example Wishlist, Applied). Use the names with list_jobs, create_job and update_job.",
      scope: "read",
      input: {},
    },
    (_args, userId) => read.readStatuses(userId),
  );

  tool(
    server,
    auth,
    {
      name: "list_jobs",
      title: "List tracked jobs",
      description:
        "The user's tracked jobs, newest activity first, without descriptions. Filter by stage name or a company/title search. Use get_job for the full details.",
      scope: "read",
      input: {
        status: z
          .string()
          .max(60)
          .optional()
          .describe("Stage name, e.g. Applied"),
        query: z
          .string()
          .max(100)
          .optional()
          .describe("Matches company or title"),
        limit,
      },
    },
    (args, userId) => read.readJobs(userId, args),
  );

  tool(
    server,
    auth,
    {
      name: "list_jobs_to_apply",
      title: "Jobs the user asked you to apply to",
      description:
        "The jobs the user ticked 'Apply with AI'. 'eligible' jobs are in the Ready to apply stage with every answer filled in and not yet applied: for each, open applyUrl, fill the form with the given answers EXACTLY (never change or add facts), attach the resume named in 'resume' if the form asks for one, submit, then call log_application with outcome 'applied' and every field you sent, and update_job to move it to Applied. 'skipped' jobs are NOT to be applied to: tell the user why. Never apply to a job that is not in 'eligible'. If a site asks for a login, a CAPTCHA or a verification code, stop and tell the user instead of continuing.",
      scope: "read",
      input: {},
    },
    (_args, userId) => read.readJobsToApply(userId),
  );

  tool(
    server,
    auth,
    {
      name: "get_job",
      title: "Get a job",
      description:
        "One tracked job in full: description, notes, Trackr's match and Claude's, contacts, recent history, and the resumes, outreach drafts and answers linked to it.",
      scope: "read",
      input: { jobId: id },
    },
    async (args, userId) => {
      const job = await read.readJob(userId, args.jobId);
      if (!job) throw new ToolError("Job not found.");
      return job;
    },
  );

  tool(
    server,
    auth,
    {
      name: "get_resume",
      title: "Get a resume",
      description:
        "A resume's title, linked job and full content (a snapshot of the profile). Text fields may use **bold**, *italic*, [links](url), and lines starting with '## ' as sub-headings.",
      scope: "read",
      input: { resumeId: id },
    },
    async (args, userId) => {
      const resume = await read.readResume(userId, args.resumeId);
      if (!resume) throw new ToolError("Resume not found.");
      return resume;
    },
  );

  tool(
    server,
    auth,
    {
      name: "list_answers",
      title: "Search the answer bank",
      description:
        "The user's saved answers to application questions, newest first. Search by words in the question or answer, or filter by tag. Check this before drafting a new answer to an application question, and try a few different keywords because the search matches words, not meaning.",
      scope: "read",
      input: {
        query: z.string().max(100).optional(),
        tag: z.string().max(30).optional(),
        limit,
      },
    },
    (args, userId) => read.readAnswers(userId, args),
  );

  // Write tools are always listed; a read-only token gets a clear refusal when it calls one.
  registerWriteTools(server, auth);

  return server;
}
