"use client";

import { format, formatDistanceToNowStrict } from "date-fns";

/**
 * "3 days ago" style timestamp. The text depends on the current time, so the
 * server and browser render slightly different strings; that difference is
 * expected and suppressed for this element only.
 */
export function RelativeTime({
  date,
  className,
}: {
  date: Date | string;
  className?: string;
}) {
  const d = new Date(date);
  return (
    <time
      dateTime={d.toISOString()}
      title={format(d, "PPpp")}
      className={className}
      suppressHydrationWarning
    >
      {formatDistanceToNowStrict(d, { addSuffix: true })}
    </time>
  );
}

/** An absolute date and time in the viewer's own time zone (server output may differ). */
export function LocalDateTime({
  date,
  className,
}: {
  date: Date | string;
  className?: string;
}) {
  const d = new Date(date);
  return (
    <time
      dateTime={d.toISOString()}
      className={className}
      suppressHydrationWarning
    >
      {format(d, "EEE d MMM, HH:mm")}
    </time>
  );
}
