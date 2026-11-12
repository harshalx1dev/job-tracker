import { z } from "zod";

/** Validation for the Answer bank, shared by the app and the Claude connector. */

export const answerQuestion = z
  .string()
  .trim()
  .min(8, "Write out the full question")
  .max(1000);

export const answerSaveSchema = z.object({
  id: z.string().optional(),
  question: answerQuestion,
  answer: z.string().trim().min(1, "The answer is empty").max(6000),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  jobId: z.string().optional(),
  wordLimit: z.number().int().min(20).max(2000).optional(),
});
