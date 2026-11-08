"use client";

import { forwardRef, memo } from "react";
import { CalendarClock, MapPin } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";
import { PRIORITY_META, WORK_MODE_LABEL, type Job } from "./utils";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  job: Job;
  /** Rendered inside the drag overlay (the lifted copy). */
  overlay?: boolean;
  /** The card's original slot while it is being dragged. */
  placeholder?: boolean;
};

export const CompanyMark = ({
  company,
  className,
}: {
  company: string;
  className?: string;
}) => (
  <span
    aria-hidden
    className={cn(
      "grid size-6 shrink-0 place-items-center rounded-md border bg-surface font-mono text-[11px] font-medium text-muted-foreground uppercase",
      className,
    )}
  >
    {company.slice(0, 1)}
  </span>
);

export const PriorityBars = ({ priority }: { priority: Job["priority"] }) => {
  const level = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  return (
    <span
      className="flex h-3 items-end gap-[2px]"
      title={`${PRIORITY_META[priority].label} priority`}
      aria-label={`${PRIORITY_META[priority].label} priority`}
      role="img"
    >
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn(
            "w-[3px] rounded-[1px]",
            n === 1 ? "h-1.5" : n === 2 ? "h-2" : "h-3",
            n <= level
              ? priority === "high"
                ? "bg-rose-500"
                : "bg-foreground/60"
              : "bg-foreground/15",
          )}
        />
      ))}
    </span>
  );
};

const JobCardBase = forwardRef<HTMLDivElement, Props>(function JobCard(
  { job, overlay, placeholder, className, ...rest },
  ref,
) {
  const where = [job.location, job.workMode && WORK_MODE_LABEL[job.workMode]]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "group/card relative rounded-xl border bg-card p-3 text-left outline-none select-none",
        "touch-manipulation focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        overlay
          ? "cursor-grabbing border-foreground/20"
          : "lift cursor-grab hover:border-foreground/20",
        // The empty slot left behind while dragging: same size, dashed, content hidden.
        placeholder &&
          "border-dashed border-foreground/20 bg-transparent shadow-none hover:translate-y-0 [&>*]:invisible",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <CompanyMark company={job.company} />
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
          {job.company}
        </span>
        <PriorityBars priority={job.priority} />
      </div>

      <p className="mt-2 line-clamp-2 text-[15px] leading-snug font-medium tracking-[-0.01em]">
        {job.title}
      </p>

      {where && (
        <p className="mt-1.5 flex items-center gap-1 truncate text-[13px] text-muted-foreground">
          <MapPin className="size-3 shrink-0 opacity-70" />
          {where}
        </p>
      )}

      {job.skills.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {job.skills.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded-md border bg-surface px-1.5 py-px text-xs text-muted-foreground"
            >
              {s}
            </span>
          ))}
          {job.skills.length > 3 && (
            <span className="tabular px-1 py-px text-xs text-muted-foreground">
              +{job.skills.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-dashed pt-2.5 text-xs text-muted-foreground">
        <RelativeTime date={job.updatedAt} />
        {job.interviewAt && (
          <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
            <CalendarClock className="size-3" />
            <RelativeTime date={job.interviewAt} />
          </span>
        )}
      </div>
    </div>
  );
});

export const JobCard = memo(JobCardBase);
