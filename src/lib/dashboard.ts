/**
 * Pure dashboard maths, kept free of the database so it can be unit tested.
 * Inputs are plain rows; `now` is passed in so results are deterministic.
 */

export type DashJob = {
  id: string;
  company: string;
  title: string;
  statusId: string;
  appliedAt: Date | null;
  interviewAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DashStatus = {
  id: string;
  name: string;
  color: string;
  kind: "open" | "won" | "lost";
  position: number;
};

export type DashEvent = {
  id: string;
  jobId: string;
  type: string;
  fromStatusId: string | null;
  toStatusId: string | null;
  createdAt: Date;
};

const DAY = 86_400_000;
export const FOLLOW_UP_AFTER_DAYS = 7;
export const WEEKS = 8;

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStart(d: Date) {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dow = (x.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(x.getTime() - dow * DAY);
}

/** The "Applied" stage: by name, else the second stage (after Wishlist). */
export function appliedStage(statuses: DashStatus[]) {
  const sorted = [...statuses].sort((a, b) => a.position - b.position);
  return (
    sorted.find((s) => s.name.toLowerCase() === "applied") ??
    sorted[1] ??
    sorted[0]
  );
}

export function computeDashboard(
  jobs: DashJob[],
  statuses: DashStatus[],
  events: DashEvent[],
  now: Date,
) {
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const applied = appliedStage(statuses);
  const appliedPos = applied?.position ?? 1;
  const posOf = (j: DashJob) => byId.get(j.statusId)?.position ?? 0;
  const kindOf = (j: DashJob) => byId.get(j.statusId)?.kind ?? "open";
  const isGhosted = (j: DashJob) =>
    byId.get(j.statusId)?.name.toLowerCase() === "ghosted";

  // Sent applications: anything at or past the Applied stage, or with an applied date.
  const sent = jobs.filter((j) => j.appliedAt || posOf(j) >= appliedPos);
  // A response is any move past Applied, except silence (Ghosted).
  const responded = sent.filter((j) => posOf(j) > appliedPos && !isGhosted(j));

  const active = jobs.filter((j) => kindOf(j) === "open").length;
  const offers = jobs.filter((j) => kindOf(j) === "won").length;
  const responseRate = sent.length
    ? Math.round((responded.length / sent.length) * 100)
    : null;

  const upcoming = jobs
    .filter((j) => j.interviewAt && j.interviewAt.getTime() >= now.getTime())
    .sort((a, b) => a.interviewAt!.getTime() - b.interviewAt!.getTime())
    .slice(0, 5);

  const followUps = jobs
    .filter(
      (j) =>
        j.statusId === applied?.id &&
        now.getTime() - j.updatedAt.getTime() >= FOLLOW_UP_AFTER_DAYS * DAY,
    )
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
    .slice(0, 5);

  // Applications per week, oldest first, the current week last.
  const thisWeek = weekStart(now).getTime();
  const weekly = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(thisWeek - (WEEKS - 1 - i) * 7 * DAY);
    return { start, count: 0 };
  });
  for (const j of sent) {
    const t = weekStart(j.appliedAt ?? j.createdAt).getTime();
    const slot = weekly.find((w) => w.start.getTime() === t);
    if (slot) slot.count++;
  }

  const stages = [...statuses]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      ...s,
      count: jobs.filter((j) => j.statusId === s.id).length,
    }));

  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const activity = [...events]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8)
    .map((e) => ({
      ...e,
      job: jobById.get(e.jobId) ?? null,
      to: e.toStatusId ? (byId.get(e.toStatusId)?.name ?? null) : null,
    }));

  return {
    totals: {
      all: jobs.length,
      active,
      offers,
      sent: sent.length,
      responded: responded.length,
    },
    responseRate,
    appliedThisWeek: weekly.at(-1)?.count ?? 0,
    weekly,
    stages,
    upcoming,
    followUps,
    activity,
  };
}

export type Dashboard = ReturnType<typeof computeDashboard>;
