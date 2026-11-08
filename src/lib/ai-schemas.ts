import { z } from "zod";

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

export type JobMatch = z.infer<typeof jobMatchSchema> & { at: string };
