import { z } from "zod";
import { FACTOR_KEYS } from "./match-scoring";

/** What the AI extracts from a pasted job description (the user reviews before saving). */
export const jobImportSchema = z.object({
  company: z.string().max(120).describe("Hiring company; empty if not stated"),
  title: z.string().max(160).describe("Role title as written"),
  location: z.string().max(120).describe("City or region; empty if not stated"),
  workMode: z.enum(["remote", "hybrid", "onsite", "unknown"]),
  salaryMin: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe("Yearly, in the stated currency; null if not stated"),
  salaryMax: z.number().int().nonnegative().nullable(),
  currency: z
    .string()
    .max(8)
    .describe("ISO code like INR, USD; empty if not stated"),
  skills: z
    .array(z.string().max(40))
    .max(20)
    .describe("Concrete technologies and skills, short names"),
  summary: z
    .string()
    .max(600)
    .describe("Two or three plain sentences on what the role does"),
});

export type JobImport = z.infer<typeof jobImportSchema>;

/** Questions that fill gaps in a profile (the user answers, skips or says they don't know). */
export const profileQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z
          .string()
          .max(300)
          .describe(
            "One specific question, addressed to the candidate as 'you'",
          ),
        about: z
          .string()
          .max(120)
          .describe(
            "The role, project or topic it concerns (e.g. 'DEPT Agency', 'Career goals'); empty if general",
          ),
      }),
    )
    .max(12),
});

/** How well the profile fits a job. Stored on the job as `match`. */
export const jobMatchSchema = z.object({
  score: z.number().int().min(0).max(100).describe("Overall fit, 0 to 100"),
  verdict: z.string().max(200).describe("One plain sentence"),
  matched: z
    .array(z.string().max(60))
    .max(15)
    .describe("Requirements the candidate clearly meets"),
  missing: z
    .array(z.string().max(60))
    .max(15)
    .describe("Requirements with no evidence in the profile"),
  suggestions: z
    .array(z.string().max(240))
    .max(5)
    .describe("Concrete edits to the resume for this job, each one sentence"),
});

/** One factor of a score, saved by Claude through the connector: what it earned and why. */
export const breakdownItemSchema = z.object({
  factor: z.enum(FACTOR_KEYS),
  points: z.number().int().min(0).max(50),
  reason: z
    .string()
    .min(1)
    .max(240)
    .describe("One plain sentence on why it earned this many points"),
});

export type JobMatch = z.infer<typeof jobMatchSchema> & {
  at: string;
  /** Present when Claude assessed the job: how the score adds up, factor by factor. */
  breakdown?: z.infer<typeof breakdownItemSchema>[];
  /** The dealbreaker that capped the score at 40, if any. */
  cappedBy?: string;
};
