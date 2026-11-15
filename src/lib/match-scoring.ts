/**
 * How Claude scores a job (0 to 100) when it searches for the user. One text,
 * shown in Preferences and in Claude's playbook, so what the user reads is what
 * Claude does.
 */

export const DEFAULT_MIN_SCORE = 70;

/** A job is added to the Wishlist from this score (or the minimum score, if lower). */
export const TRACK_SCORE = 50;

export const SCORE_BANDS = [
  {
    range: "0 to 29",
    meaning: "Poor",
    why: "Most required skills are missing, or it is a different kind of role.",
    action: "Not tracked.",
  },
  {
    range: "30 to 49",
    meaning: "Weak",
    why: "Big skill gaps, or it conflicts with your preferences.",
    action: "Not tracked.",
  },
  {
    range: "50 to 69",
    meaning: "Partial",
    why: "A real chance, with some gaps.",
    action: "Added to the Wishlist, no application prepared.",
  },
  {
    range: "70 to 84",
    meaning: "Good",
    why: "Most requirements are covered.",
    action: "Added, and the application is prepared.",
  },
  {
    range: "85 to 100",
    meaning: "Strong",
    why: "Nearly everything matches.",
    action: "Added, prepared and flagged as a top pick.",
  },
] as const;

export const SCORE_FACTORS = [
  {
    key: "skills",
    points: 50,
    name: "Skills",
    detail:
      "How many of the job's required skills your profile lists. Nice-to-haves count for less.",
  },
  {
    key: "role",
    points: 20,
    name: "Role and level",
    detail:
      "Whether it matches one of your target roles (roles listed first count more), and whether the experience asked for fits yours.",
  },
  {
    key: "work",
    points: 15,
    name: "Kind of work",
    detail:
      "Whether the duties are what you want, for example frontend-heavy rather than backend-heavy.",
  },
  {
    key: "conditions",
    points: 15,
    name: "Conditions",
    detail: "Location, work mode and pay (when the posting states it).",
  },
] as const;

export const SCORE_DEALBREAKERS =
  "A job is capped at 40 and not tracked if it needs a location or work mode you don't accept, states pay below your floor, is on your skip list, or requires a skill you don't claim.";

/** Plain-text version, for Claude's playbook. */
export function scoringRubricText() {
  return [
    'Score how well this person fits this job from 0 to 100, using only the profile (in the lines below, "your" means the user, not you):',
    ...SCORE_FACTORS.map((f) => `- ${f.name} (${f.points}): ${f.detail}`),
    SCORE_DEALBREAKERS,
    "What the score means:",
    ...SCORE_BANDS.map(
      (b) => `- ${b.range}, ${b.meaning}: ${b.why} ${b.action}`,
    ),
  ].join("\n");
}

export type FactorKey = (typeof SCORE_FACTORS)[number]["key"];
export const FACTOR_KEYS = SCORE_FACTORS.map((f) => f.key) as [
  FactorKey,
  ...FactorKey[],
];

/** The band a score falls in (same ranges as the table above). */
export function bandFor(score: number) {
  const i =
    score >= 85 ? 4 : score >= 70 ? 3 : score >= 50 ? 2 : score >= 30 ? 1 : 0;
  return SCORE_BANDS[i];
}

export type BreakdownItem = {
  factor: FactorKey;
  points: number;
  reason: string;
};

/**
 * Checks that a breakdown explains its score. Returns a message that tells the
 * caller (Claude, through the connector) exactly how to fix it, or null if fine.
 */
export function breakdownProblem(m: {
  score: number;
  breakdown?: BreakdownItem[];
  cappedBy?: string;
}): string | null {
  const { score, breakdown, cappedBy } = m;
  if (!breakdown) return cappedBy ? "cappedBy needs a breakdown." : null;
  const seen = new Set<string>();
  let sum = 0;
  for (const b of breakdown) {
    const f = SCORE_FACTORS.find((x) => x.key === b.factor);
    if (!f) return `Unknown factor "${b.factor}".`;
    if (seen.has(b.factor))
      return `Factor "${b.factor}" appears twice: give each factor once.`;
    seen.add(b.factor);
    if (b.points > f.points)
      return `"${b.factor}" is out of ${f.points}, but you gave ${b.points} points.`;
    sum += b.points;
  }
  const missing = FACTOR_KEYS.filter((k) => !seen.has(k));
  if (missing.length)
    return `The breakdown is missing: ${missing.join(", ")}. Give one entry for each of ${FACTOR_KEYS.join(", ")}.`;
  if (cappedBy) {
    if (score > 40) return "A job with a cappedBy reason scores at most 40.";
    if (score > sum)
      return `score (${score}) is more than the points added up (${sum}).`;
    return null;
  }
  if (score !== sum)
    return `score is ${score} but the four factor points add up to ${sum}. Make score equal the sum (or set cappedBy if a dealbreaker caps it at 40).`;
  return null;
}
