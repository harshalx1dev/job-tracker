"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";
import type { ReviewedJob as Row } from "@/server/jobs/reviewed";

export type ReviewedJob = Row;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "skipped", label: "Skipped" },
  { id: "saved", label: "Saved" },
] as const;

/** Every listing Claude looked at during searches, and why it was saved or skipped. */
export function ReviewedView({
  rows,
  query,
}: {
  rows: ReviewedJob[];
  query: string;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.decision === filter) &&
        (!q ||
          r.company.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q)),
    );
  }, [rows, filter, query]);

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="flex gap-1.5 pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[13px] transition-colors",
              filter === f.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {!shown.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {rows.length
            ? "Nothing matches."
            : "Nothing logged yet. Listings Claude looks at during a search appear here."}
        </p>
      ) : (
        <ul className="divide-y">
          {shown.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium tracking-[-0.01em]">
                  {r.title}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {r.company} · {r.source} ·{" "}
                  <RelativeTime date={r.reviewedAt} />
                </p>
                <p className="mt-1 text-[13px]">{r.reason}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[13px]">
                {r.score !== null && (
                  <span className="font-mono tabular">{r.score}</span>
                )}
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs",
                    r.decision === "saved"
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {r.decision === "saved" ? "Saved" : "Skipped"}
                </span>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open listing"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
