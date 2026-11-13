import { z } from "zod";

export const submittedFieldSchema = z.object({
  field: z.string().trim().min(1).max(200),
  value: z.string().max(4000),
  /** True when Claude has no fact to answer with: the user must fill it in. */
  missing: z.boolean().optional(),
});

export const applicationInputSchema = z.object({
  jobId: z.string().min(1).max(100),
  platform: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .describe("Where it was sent, e.g. LinkedIn, Naukri, Company site, Email"),
  outcome: z
    .enum(["applied", "failed", "needs_input", "prepared"])
    .describe(
      "applied: you submitted it. prepared: you only read the form and drafted answers for the user to copy and submit themselves (do NOT submit). failed: you tried and could not. needs_input: you are blocked on a fact from the user",
    ),
  url: z.string().max(2000).optional(),
  resumeId: z.string().max(100).optional(),
  submitted: z.array(submittedFieldSchema).max(60).default([]),
  failureReason: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

export type SummaryItem = {
  company: string;
  title: string;
  location: string | null;
  workMode: string | null;
  description: string | null;
  outcome: "applied" | "failed" | "needs_input" | "prepared";
  platform: string;
  failureReason: string | null;
  link: string;
};

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const line = (i: SummaryItem) =>
  [
    `${i.company} · ${i.title}`,
    [i.location, i.workMode].filter(Boolean).join(", "),
    i.description ? clip(i.description, 280) : "",
    `Via ${i.platform}`,
    i.failureReason ? `Reason: ${clip(i.failureReason, 300)}` : "",
    i.link,
  ]
    .filter(Boolean)
    .join("\n");

/**
 * The email body, built on the server from stored rows. The only free text
 * from Claude is a short intro; every link comes from Trackr's own ids.
 */
export function buildApplicationSummary(opts: {
  items: SummaryItem[];
  intro?: string;
}) {
  const applied = opts.items.filter((i) => i.outcome === "applied");
  const ready = opts.items.filter((i) => i.outcome === "prepared");
  const stuck = opts.items.filter(
    (i) => i.outcome === "failed" || i.outcome === "needs_input",
  );
  const parts: string[] = [];
  if (opts.intro?.trim()) parts.push(clip(opts.intro, 500));
  if (applied.length)
    parts.push(
      `Applied (${applied.length})\n\n${applied.map(line).join("\n\n")}`,
    );
  if (ready.length)
    parts.push(
      `Ready for you to apply (${ready.length}). Open each link, copy the answers and submit.\n\n${ready.map(line).join("\n\n")}`,
    );
  if (stuck.length)
    parts.push(
      `Could not apply (${stuck.length}). Apply by hand, or give Claude what is missing.\n\n${stuck.map(line).join("\n\n")}`,
    );
  const counts = [
    applied.length ? `${applied.length} applied` : "",
    ready.length ? `${ready.length} ready to apply` : "",
    stuck.length ? `${stuck.length} need you` : "",
  ].filter(Boolean);
  return {
    subject: `Trackr: ${counts.join(", ")}`,
    text: parts.join("\n\n———\n\n"),
  };
}
