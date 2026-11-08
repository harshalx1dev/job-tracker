"use client";

import { useState } from "react";
import { niceTicks } from "@/lib/chart-ticks";
import { statusColor } from "@/lib/status-colors";
import { cn } from "@/lib/utils";

/** Week starts are UTC Mondays; format them in UTC so server and browser agree. */
const weekFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const weekFmtLong = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function Tooltip({
  children,
  style,
}: {
  children: React.ReactNode;
  style: React.CSSProperties;
}) {
  return (
    <div
      role="tooltip"
      style={style}
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
    >
      {children}
    </div>
  );
}

/** Applications sent per week: one series, so no legend; the title names it. */
export function WeeklyColumns({
  weeks,
}: {
  weeks: { start: Date; count: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...weeks.map((w) => w.count), 0);
  const ticks = niceTicks(max);
  const top = ticks.at(-1)!;
  const last = weeks.length - 1;

  return (
    <figure>
      <div className="relative ml-8 h-48">
        {/* Hairline gridlines and their tick labels, recessive. */}
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute inset-x-0 border-t"
            style={{ bottom: `${(t / top) * 100}%` }}
            aria-hidden
          >
            <span className="absolute -left-8 w-6 -translate-y-1/2 text-right font-mono text-[11px] text-muted-foreground">
              {t}
            </span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end">
          {weeks.map((w, i) => (
            <button
              key={w.start.toISOString()}
              type="button"
              className="group relative flex h-full flex-1 items-end justify-center outline-none"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`Week of ${weekFmt.format(w.start)}: ${w.count} applications`}
            >
              <span
                className={cn(
                  "w-[min(24px,60%)] rounded-t-[4px] bg-chart-1 transition-opacity duration-150",
                  hover !== null && hover !== i && "opacity-45",
                )}
                style={{
                  height: `${(w.count / top) * 100}%`,
                  minHeight: w.count ? 2 : 0,
                }}
              />
              {/* Selective label: only the current week's value, on its cap. */}
              {i === last && w.count > 0 && (
                <span
                  className="absolute font-mono text-xs text-foreground"
                  style={{ bottom: `calc(${(w.count / top) * 100}% + 4px)` }}
                >
                  {w.count}
                </span>
              )}
              {hover === i && (
                <Tooltip
                  style={{
                    left: "50%",
                    bottom: `calc(${(w.count / top) * 100}% + 10px)`,
                  }}
                >
                  <span className="text-muted-foreground">
                    Week of {weekFmt.format(w.start)}
                  </span>
                  <span className="ml-2 font-mono font-medium text-foreground">
                    {w.count}
                  </span>
                </Tooltip>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 ml-8 flex" aria-hidden>
        {weeks.map((w, i) => (
          <span
            key={w.start.toISOString()}
            className={cn(
              "flex-1 text-center text-[11px] text-muted-foreground",
              i % 2 === 1 && i !== last && "max-sm:invisible",
            )}
          >
            {i === last ? "This wk" : weekFmt.format(w.start)}
          </span>
        ))}
      </div>
      <TableView
        caption="Applications per week"
        head={["Week of", "Applications"]}
        rows={weeks.map((w) => [weekFmtLong.format(w.start), String(w.count)])}
      />
    </figure>
  );
}

/** Jobs in each stage: thin horizontal bars, stage dot beside the name, value at the tip. */
export function StageBars({
  stages,
}: {
  stages: { id: string; name: string; color: string; count: number }[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...stages.map((s) => s.count), 1);
  const total = stages.reduce((n, s) => n + s.count, 0);

  return (
    <figure>
      <ul className="space-y-1">
        {stages.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="group grid h-8 w-full grid-cols-[7.5rem_1fr] items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.id)}
              onBlur={() => setHover(null)}
              aria-label={`${s.name}: ${s.count} jobs`}
            >
              <span className="flex min-w-0 items-center gap-2 text-[13px]">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    statusColor(s.color).dot,
                  )}
                />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="relative flex h-full items-center">
                <span
                  className={cn(
                    "h-2.5 rounded-r-[4px] bg-chart-1 transition-opacity duration-150",
                    hover && hover !== s.id && "opacity-45",
                  )}
                  style={{
                    width: `${(s.count / max) * 82}%`,
                    minWidth: s.count ? 3 : 0,
                  }}
                />
                <span className="ml-2 font-mono text-xs text-muted-foreground tabular">
                  {s.count}
                </span>
                {hover === s.id && total > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {Math.round((s.count / total) * 100)}% of jobs
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <TableView
        caption="Jobs in each stage"
        head={["Stage", "Jobs"]}
        rows={stages.map((s) => [s.name, String(s.count)])}
      />
    </figure>
  );
}

/** The table view every chart carries (screen readers, and a click away for anyone). */
function TableView({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="w-fit cursor-pointer rounded transition-colors hover:text-foreground">
        Show as table
      </summary>
      <table className="mt-2 w-full">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b">
            {head.map((h) => (
              <th key={h} className="py-1.5 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b last:border-0">
              {r.map((c, i) => (
                <td
                  key={i}
                  className={cn("py-1.5 text-foreground", i > 0 && "font-mono")}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
