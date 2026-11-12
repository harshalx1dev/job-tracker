import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const jobInputSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(120),
  title: z.string().trim().min(1, "Role is required").max(160),
  statusId: z.string().min(1),
  location: optionalText(120),
  workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
  url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.url("Enter a valid URL").optional()),
  source: optionalText(60),
  salaryMin: z.coerce.number().int().nonnegative().optional(),
  salaryMax: z.coerce.number().int().nonnegative().optional(),
  currency: optionalText(8),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  skills: z.array(z.string().trim().min(1).max(40)).max(40).default([]),
  description: optionalText(20_000),
  notes: optionalText(10_000),
  appliedAt: z.coerce.date().optional(),
  interviewAt: z.coerce.date().optional(),
});

export type JobInput = z.input<typeof jobInputSchema>;
/** A job after validation (defaults applied, empty strings dropped). */
export type ParsedJob = z.output<typeof jobInputSchema>;

export const moveJobSchema = z.object({
  jobId: z.string().min(1),
  toStatusId: z.string().min(1),
  /** Neighbors in the destination column after the move (null = edge). */
  beforeId: z.string().nullable(),
  afterId: z.string().nullable(),
});

export type MoveJobInput = z.infer<typeof moveJobSchema>;
