import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAYBOOK } from "./claude-playbook";

describe("claude playbook", () => {
  it("matches docs/claude-playbook.md (run: npx tsx scripts/write-playbook.ts)", () => {
    expect(readFileSync("docs/claude-playbook.md", "utf8")).toBe(PLAYBOOK);
  });

  it("names every tool the connector offers", () => {
    for (const tool of [
      "get_playbook",
      "get_profile",
      "list_statuses",
      "list_jobs",
      "get_job",
      "list_resumes",
      "get_resume",
      "list_answers",
      "list_jobs_to_apply",
      "create_job",
      "update_job",
      "save_resume_version",
      "save_outreach_draft",
      "save_answer",
      "log_application",
      "email_me_summary",
    ])
      expect(PLAYBOOK, tool).toContain(tool);
  });
});
