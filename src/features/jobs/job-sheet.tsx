"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { motion } from "motion/react";
import {
  Archive,
  CalendarClock,
  ExternalLink,
  MapPin,
  Pencil,
  Signal,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getJobExtras } from "@/server/jobs/contact-actions";
import type { Contact, JobEvent } from "@/server/db/schema";
import type { JobApplication } from "@/server/jobs/queries";
import { ApplicationsSection } from "./applications-section";
import { ContactsSection } from "./contacts-section";
import { ClaudeMatchPanel, MatchPanel } from "./match-panel";
import { JobPrep } from "@/features/prep/job-prep";
import { statusColor } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { CompanyMark, PriorityBars } from "./job-card";
import { StatusSelect } from "./status-select";
import {
  PRIORITY_META,
  WORK_MODE_LABEL,
  ago,
  formatSalary,
  type Job,
  type Status,
} from "./utils";

export function JobSheet({
  job,
  statuses,
  open,
  onOpenChange,
  onStatusChange,
  onEdit,
  onArchive,
  onDelete,
}: {
  job: Job | undefined;
  statuses: Status[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (jobId: string, statusId: string) => void;
  onEdit: (job: Job) => void;
  onArchive: (job: Job) => void;
  onDelete: (job: Job) => void;
}) {
  // Reload the timeline when the drawer opens or the job changes (status, edits).
  const timelineKey =
    open && job
      ? `${job.id}:${job.statusId}:${new Date(job.updatedAt).getTime()}`
      : null;
  const [timeline, setTimeline] = useState<{
    key: string;
    events: JobEvent[];
    contacts: Contact[];
    applications: JobApplication[];
    plans: {
      id: string;
      kind: string;
      days: number;
      total: number;
      minutes: number;
      done: number;
    }[];
  } | null>(null);
  const fresh = timeline && timeline.key === timelineKey ? timeline : null;
  const events = fresh?.events ?? null;

  useEffect(() => {
    if (!timelineKey) return;
    let cancelled = false;
    getJobExtras(timelineKey.split(":")[0]).then((extras) => {
      if (!cancelled) setTimeline({ key: timelineKey, ...extras });
    });
    return () => {
      cancelled = true;
    };
  }, [timelineKey]);

  const statusName = (id: string | null) =>
    statuses.find((s) => s.id === id)?.name ?? "a removed status";
  const statusTone = (id: string | null) =>
    statusColor(statuses.find((s) => s.id === id)?.color ?? "slate");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {job && (
          <>
            <SheetHeader className="border-b p-5">
              <div className="flex items-start gap-3 pr-8">
                <CompanyMark
                  company={job.company}
                  className="size-11 rounded-xl text-base"
                />
                <div className="min-w-0">
                  <SheetTitle className="text-xl leading-tight font-medium tracking-[-0.02em]">
                    {job.title}
                  </SheetTitle>
                  <SheetDescription className="mt-0.5">
                    {job.company}
                  </SheetDescription>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusSelect
                  size="sm"
                  statuses={statuses}
                  value={job.statusId}
                  onChange={(s) => onStatusChange(job.id, s)}
                />
                <Button size="sm" variant="outline" onClick={() => onEdit(job)}>
                  <Pencil /> Edit
                </Button>
                {job.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" /> Posting
                  </a>
                )}
              </div>
            </SheetHeader>

            <div className="space-y-6 p-5">
              <dl className="text-sm">
                <Fact icon={MapPin} label="Location">
                  {[job.location, job.workMode && WORK_MODE_LABEL[job.workMode]]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Fact>
                <Fact icon={Wallet} label="Salary">
                  {formatSalary(job) ?? "—"}
                </Fact>
                <Fact icon={CalendarClock} label="Applied">
                  {job.appliedAt
                    ? format(new Date(job.appliedAt), "d MMM yyyy")
                    : "—"}
                </Fact>
                <Fact icon={CalendarClock} label="Interview">
                  {job.interviewAt
                    ? format(new Date(job.interviewAt), "d MMM yyyy, HH:mm")
                    : "—"}
                </Fact>
                <Fact icon={Signal} label="Priority">
                  <span className="inline-flex items-center gap-2">
                    <PriorityBars priority={job.priority} />
                    {PRIORITY_META[job.priority].label}
                  </span>
                </Fact>
              </dl>

              {job.skills.length > 0 && (
                <Section title="Skills">
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {job.description && (
                <Section title="Description">
                  <p className="max-h-64 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {job.description}
                  </p>
                </Section>
              )}

              {job.notes && (
                <Section title="Notes">
                  <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
                </Section>
              )}

              <Section title="Fit with your profile">
                <div className="space-y-4">
                  <MatchPanel jobId={job.id} match={job.match ?? null} />
                  {job.claudeMatch && (
                    <ClaudeMatchPanel match={job.claudeMatch} />
                  )}
                </div>
              </Section>

              <Section title="Interview prep">
                <JobPrep
                  key={job.id}
                  jobId={job.id}
                  interviewAt={job.interviewAt}
                  initial={fresh?.plans ?? null}
                />
              </Section>

              {fresh && fresh.applications.length > 0 && (
                <Section title="Applications">
                  <ApplicationsSection list={fresh.applications} />
                </Section>
              )}

              <Section title="Contacts">
                <ContactsSection
                  key={job.id}
                  jobId={job.id}
                  initial={fresh?.contacts ?? null}
                />
              </Section>

              <Section title="Timeline">
                {events === null ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <ol className="relative space-y-4 border-l pl-4">
                    {events.map((e, i) => (
                      <motion.li
                        key={e.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="relative text-sm"
                      >
                        <span
                          className={cn(
                            "absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-background",
                            e.type === "status_changed"
                              ? statusTone(e.toStatusId).dot
                              : "bg-muted-foreground/50",
                          )}
                        />
                        <p>
                          {e.type === "created" && (
                            <>Added to {statusName(e.toStatusId)}</>
                          )}
                          {e.type === "status_changed" && (
                            <>
                              Moved from {statusName(e.fromStatusId)} to{" "}
                              <span className="font-medium">
                                {statusName(e.toStatusId)}
                              </span>
                            </>
                          )}
                          {e.type === "updated" && "Details updated"}
                          {e.type === "archived" && "Archived"}
                          {e.type === "restored" && "Restored"}
                          {e.type === "note" && "Note added"}
                        </p>
                        <p
                          className="text-xs text-muted-foreground"
                          title={format(new Date(e.createdAt), "PPpp")}
                        >
                          {ago(e.createdAt)}
                        </p>
                      </motion.li>
                    ))}
                  </ol>
                )}
              </Section>

              <div className="flex gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onArchive(job)}
                >
                  <Archive /> Archive
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(job)}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-11 items-center gap-3 border-b last:border-0">
      <dt className="flex w-28 shrink-0 items-center gap-2 text-[13px] text-muted-foreground">
        <Icon className="size-3.5 opacity-70" /> {label}
      </dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-[13px] font-medium text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
