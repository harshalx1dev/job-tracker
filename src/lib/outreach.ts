import { z } from "zod";

/**
 * Outreach channels and their hard limits. LinkedIn changes its limits from time to
 * time; these are the last documented values (connection note 200 characters on free
 * accounts, 300 on Premium; InMail subject 200, body 1,900). Re-check before launch.
 */
export const CHANNELS = [
  {
    id: "email",
    label: "Cold email",
    subjectMax: 80,
    bodyMax: 1500,
    note: "To a recruiter or hiring manager",
  },
  {
    id: "follow_up",
    label: "Follow-up email",
    subjectMax: 80,
    bodyMax: 800,
    note: "After applying or a quiet week",
  },
  {
    id: "linkedin_note",
    label: "LinkedIn connection note",
    subjectMax: 0,
    bodyMax: 200,
    note: "Sent with a connection request",
  },
  {
    id: "linkedin_inmail",
    label: "LinkedIn InMail",
    subjectMax: 200,
    bodyMax: 1900,
    note: "When you can't connect first",
  },
  {
    id: "linkedin_dm",
    label: "LinkedIn message",
    subjectMax: 0,
    bodyMax: 1000,
    note: "To an existing connection",
  },
  {
    id: "thank_you",
    label: "Thank-you note",
    subjectMax: 80,
    bodyMax: 800,
    note: "After an interview",
  },
] as const;

export type ChannelId = (typeof CHANNELS)[number]["id"];

export const TONES = [
  { id: "warm", label: "Warm" },
  { id: "formal", label: "Formal" },
  { id: "concise", label: "Concise" },
] as const;

export type ToneId = (typeof TONES)[number]["id"];

/** LinkedIn Premium raises the connection-note limit to 300. */
export function limitsFor(channel: ChannelId, premium = false) {
  const c = CHANNELS.find((x) => x.id === channel)!;
  return {
    subjectMax: c.subjectMax,
    bodyMax: channel === "linkedin_note" && premium ? 300 : c.bodyMax,
  };
}

export const outreachRequestSchema = z.object({
  channel: z.enum(CHANNELS.map((c) => c.id) as [ChannelId, ...ChannelId[]]),
  tone: z.enum(TONES.map((t) => t.id) as [ToneId, ...ToneId[]]),
  premium: z.boolean().default(false),
  jobId: z.string().optional(),
  recipientName: z.string().trim().max(80).optional(),
  recipientRole: z.string().trim().max(80).optional(),
  goal: z.string().trim().max(600).optional(),
});

export type OutreachRequest = z.input<typeof outreachRequestSchema>;

/** A draft to save, from the app or the Claude connector. */
export const outreachSaveSchema = z.object({
  channel: z.enum(CHANNELS.map((c) => c.id) as [string, ...string[]]),
  tone: z.string().max(20),
  jobId: z.string().optional(),
  recipientName: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, "The message is empty").max(4000),
});

export const outreachDraftsSchema = z.object({
  variants: z
    .array(
      z.object({
        angle: z
          .string()
          .max(60)
          .describe(
            "Two to five words naming the approach, e.g. 'Lead with the design system'",
          ),
        subject: z
          .string()
          .max(200)
          .describe("Empty for channels without a subject"),
        body: z.string().max(4000),
      }),
    )
    .min(1)
    .max(3),
});

export type OutreachDraft = z.infer<
  typeof outreachDraftsSchema
>["variants"][number] & {
  over: boolean;
};

/** Marks drafts that exceed the channel's limits (the UI shows the count in red). */
export function checkLimits(
  drafts: { angle: string; subject: string; body: string }[],
  limits: { subjectMax: number; bodyMax: number },
): OutreachDraft[] {
  return drafts.map((d) => ({
    ...d,
    subject: limits.subjectMax ? d.subject.trim() : "",
    body: d.body.trim(),
    over:
      d.body.trim().length > limits.bodyMax ||
      (limits.subjectMax > 0 && d.subject.trim().length > limits.subjectMax),
  }));
}

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
