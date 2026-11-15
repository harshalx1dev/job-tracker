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
    points: 50,
    name: "Skills",
    detail:
      "How many of the job's required skills your profile lists. Nice-to-haves count for less.",
  },
  {
    points: 20,
    name: "Role and level",
    detail:
      "Whether it matches one of your target roles, and whether the experience asked for fits yours.",
  },
  {
    points: 15,
    name: "Kind of work",
    detail:
      "Whether the duties are what you want, for example frontend-heavy rather than backend-heavy.",
  },
  {
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
