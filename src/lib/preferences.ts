import { z } from "zod";
import { DEFAULT_MIN_SCORE } from "./match-scoring";

/** What the user wants from a job search. Claude reads this through the connector. */

export const WORK_MODES = ["remote", "hybrid", "onsite"] as const;

export const preferencesSchema = z.object({
  roles: z.string().trim().max(1000).default(""),
  locations: z.string().trim().max(1000).default(""),
  workModes: z.array(z.enum(WORK_MODES)).max(3).default([]),
  salary: z.string().trim().max(500).default(""),
  avoid: z.string().trim().max(1000).default(""),
  maxPerSession: z.number().int().min(1).max(50).default(5),
  /** Claude prepares an application only for jobs it scores at or above this. */
  minScore: z.number().int().min(0).max(100).default(DEFAULT_MIN_SCORE),
  notes: z.string().trim().max(3000).default(""),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const emptyPreferences = (): Preferences => preferencesSchema.parse({});

/** Stored data is re-validated so an older shape never crashes the page. */
export function readPreferences(data: unknown): Preferences {
  const parsed = preferencesSchema.safeParse(data);
  return parsed.success ? parsed.data : emptyPreferences();
}
