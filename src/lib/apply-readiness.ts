/**
 * Whether Claude may submit an application for a job. The rule lives here, in
 * one pure function, so the app (what the user sees) and the connector (what
 * Claude is allowed to do) can't disagree.
 */

export const READY_STAGE = "Ready to apply";

type Field = { field: string; value: string; missing?: boolean };

export type ReadinessInput = {
  applyWithAi: boolean;
  stageName: string;
  /** The user's saved answers for this job, newest first. */
  applications: {
    outcome: string;
    submitted: Field[];
    createdAt: Date | string;
  }[];
};

export type Readiness = {
  eligible: boolean;
  /** Plain reasons the job is not eligible; empty when it is. */
  reasons: string[];
  /** Fields still empty or flagged as needing the user. */
  missingFields: string[];
};

export const isMissing = (f: Field) => f.missing === true || !f.value.trim();

export function applyReadiness(input: ReadinessInput): Readiness {
  const reasons: string[] = [];
  if (!input.applyWithAi) reasons.push("Apply with AI is not ticked.");
  if (input.stageName.trim().toLowerCase() !== READY_STAGE.toLowerCase())
    reasons.push(`The job is not in the "${READY_STAGE}" stage.`);
  if (input.applications.some((a) => a.outcome === "applied"))
    reasons.push("An application was already recorded as applied.");

  const prepared = [...input.applications]
    .filter((a) => a.outcome === "prepared")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  let missingFields: string[] = [];
  if (!prepared) {
    reasons.push("There are no prepared answers for this job.");
  } else {
    missingFields = prepared.submitted.filter(isMissing).map((f) => f.field);
    if (missingFields.length)
      reasons.push(
        `Some fields still need an answer: ${missingFields.join(", ")}.`,
      );
  }
  return { eligible: reasons.length === 0, reasons, missingFields };
}
