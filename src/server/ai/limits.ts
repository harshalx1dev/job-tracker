/** Per-user caps on AI calls. Counted from the ai_usage log, so they hold across serverless instances. */
export const LIMITS = {
  user: { perHour: 60, perDay: 300 },
  admin: { perHour: 120, perDay: 1000 },
} as const;

export type KeySource = keyof typeof LIMITS;

export function limitVerdict(
  source: KeySource,
  lastHour: number,
  lastDay: number,
) {
  const l = LIMITS[source];
  if (lastHour >= l.perHour)
    return { ok: false as const, window: "hour" as const, limit: l.perHour };
  if (lastDay >= l.perDay)
    return { ok: false as const, window: "day" as const, limit: l.perDay };
  return { ok: true as const, remainingToday: l.perDay - lastDay };
}
