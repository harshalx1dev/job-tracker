import { formatDistanceToNowStrict } from "date-fns";
import type { Job, Status } from "@/server/db/schema";

export type { Job, Status };

export function byPosition(a: Job, b: Job) {
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
}

/** statusId → ordered job ids */
export function groupIds(statuses: Status[], jobs: Job[]) {
  const out: Record<string, string[]> = Object.fromEntries(
    statuses.map((s) => [s.id, []]),
  );
  for (const j of [...jobs].sort(byPosition))
    (out[j.statusId] ??= []).push(j.id);
  return out;
}

export function ago(date: Date | string | null | undefined) {
  if (!date) return null;
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}

export const PRIORITY_META = {
  low: { label: "Low" },
  medium: { label: "Medium" },
  high: { label: "High" },
} as const;

export const WORK_MODE_LABEL = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
} as const;

export function formatSalary(
  job: Pick<Job, "salaryMin" | "salaryMax" | "currency">,
) {
  const { salaryMin: min, salaryMax: max, currency } = job;
  if (!min && !max) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  const cur = currency ? `${currency} ` : "";
  if (min && max) return `${cur}${fmt(min)}–${fmt(max)}`;
  return `${cur}${fmt((min ?? max)!)}`;
}

export function matchesQuery(job: Job, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [job.company, job.title, job.location ?? "", ...job.skills].some((v) =>
    v.toLowerCase().includes(needle),
  );
}
