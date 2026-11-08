"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { generateKeyBetween } from "fractional-indexing";
import { motion } from "motion/react";
import { KanbanSquare, List, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NEW_JOB_EVENT } from "@/components/app-shell/command-menu";
import { archiveJob, deleteJob, moveJob } from "@/server/jobs/actions";
import { cn } from "@/lib/utils";
import { BoardView } from "./board-view";
import { JobFormDialog } from "./job-form-dialog";
import { JobSheet } from "./job-sheet";
import { ListView } from "./list-view";
import { byPosition, matchesQuery, type Job, type Status } from "./utils";

const VIEWS = ["board", "list"] as const;

export function JobsWorkspace({
  statuses,
  jobs: serverJobs,
}: {
  statuses: Status[];
  jobs: Job[];
}) {
  // Local copy for optimistic updates; resync whenever the server sends fresh data.
  const [jobs, setJobs] = useState(serverJobs);
  const [syncedFrom, setSyncedFrom] = useState(serverJobs);
  if (serverJobs !== syncedFrom) {
    setSyncedFrom(serverJobs);
    setJobs(serverJobs);
  }

  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(VIEWS).withDefault("board"),
  );
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [openId, setOpenId] = useQueryState("job");
  const [form, setForm] = useState<{
    open: boolean;
    job?: Job;
    statusId?: string;
  }>({ open: false });
  const [confirmDelete, setConfirmDelete] = useState<Job | null>(null);
  const [deleting, startDelete] = useTransition();

  const visible = useMemo(
    () => jobs.filter((j) => matchesQuery(j, q)),
    [jobs, q],
  );
  const openJob = jobs.find((j) => j.id === openId);
  const openJobById = useCallback(
    (id: string) => void setOpenId(id),
    [setOpenId],
  );
  const openNew = useCallback(
    (statusId?: string) => setForm({ open: true, statusId }),
    [],
  );

  // "N" shortcut and the ⌘K "Add a job" command.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey)
        return;
      if (
        el.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog]",
        )
      )
        return;
      e.preventDefault();
      openNew();
    };
    const onCommand = () => openNew();
    window.addEventListener("keydown", onKey);
    window.addEventListener(NEW_JOB_EVENT, onCommand);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(NEW_JOB_EVENT, onCommand);
    };
  }, [openNew]);

  /** Optimistic move; rolls back if the server rejects it. */
  const move = useCallback(
    async (
      jobId: string,
      toStatusId: string,
      beforeId: string | null,
      afterId: string | null,
    ) => {
      const snapshot = jobs;
      const pos = (id: string | null) =>
        id ? (jobs.find((j) => j.id === id)?.position ?? null) : null;
      let position: string;
      try {
        position = generateKeyBetween(pos(beforeId), pos(afterId));
      } catch {
        position = generateKeyBetween(
          jobs
            .filter((j) => j.statusId === toStatusId)
            .sort(byPosition)
            .at(-1)?.position ?? null,
          null,
        );
      }
      const prev = jobs.find((j) => j.id === jobId);
      setJobs((all) =>
        all.map((j) =>
          j.id === jobId
            ? { ...j, statusId: toStatusId, position, updatedAt: new Date() }
            : j,
        ),
      );

      const res = await moveJob({ jobId, toStatusId, beforeId, afterId });
      if (!res.ok) {
        setJobs(snapshot);
        toast.error(res.error);
        return;
      }
      setJobs((all) =>
        all.map((j) =>
          j.id === jobId ? { ...j, position: res.data.position } : j,
        ),
      );
      if (prev && prev.statusId !== toStatusId) {
        const to = statuses.find((s) => s.id === toStatusId);
        if (to?.kind === "won")
          toast.success(`Offer from ${prev.company}! Congratulations 🎉`);
        else
          toast(`Moved to ${to?.name}`, {
            description: `${prev.title} · ${prev.company}`,
          });
      }
    },
    [jobs, statuses],
  );

  const changeStatus = useCallback(
    (jobId: string, statusId: string) => {
      const last = jobs
        .filter((j) => j.statusId === statusId && j.id !== jobId)
        .sort(byPosition)
        .at(-1);
      void move(jobId, statusId, last?.id ?? null, null);
    },
    [jobs, move],
  );

  async function archive(job: Job) {
    setOpenId(null);
    setJobs((all) => all.filter((j) => j.id !== job.id));
    const res = await archiveJob(job.id);
    if (!res.ok) return toast.error(res.error);
    toast(`Archived ${job.company}`, {
      action: { label: "Undo", onClick: () => void archiveJob(job.id, false) },
    });
  }

  function remove(job: Job) {
    startDelete(async () => {
      await deleteJob(job.id);
      setConfirmDelete(null);
      setOpenId(null);
      toast(`Deleted ${job.title} at ${job.company}`);
    });
  }

  const active = jobs.filter(
    (j) => statuses.find((s) => s.id === j.statusId)?.kind === "open",
  ).length;
  const kindOf = (j: Job) => statuses.find((s) => s.id === j.statusId)?.kind;
  const interviewing = jobs.filter((j) =>
    statuses
      .find((s) => s.id === j.statusId)
      ?.name.toLowerCase()
      .includes("interview"),
  ).length;
  const summary = [
    { label: "active", value: active },
    { label: "interviewing", value: interviewing },
    { label: "offers", value: jobs.filter((j) => kindOf(j) === "won").length },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-end gap-x-3 gap-y-4 px-4 pt-6 pb-5 sm:px-6 sm:pt-8">
        <div className="mr-auto min-w-0">
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Jobs</h1>
          {jobs.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first application to start your board.
            </p>
          ) : (
            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              {summary.map((s) => (
                <div key={s.label} className="flex items-baseline gap-1.5">
                  <dd className="font-mono text-foreground tabular">
                    {s.value}
                  </dd>
                  <dt>{s.label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => void setQ(e.target.value || null)}
            placeholder="Search company, role, skill"
            className="h-9 pl-8"
            aria-label="Search jobs"
          />
        </div>

        <div
          role="tablist"
          aria-label="View"
          className="relative flex h-9 items-center rounded-lg border bg-surface p-0.5"
        >
          {VIEWS.map((v) => {
            const Icon = v === "board" ? KanbanSquare : List;
            const selected = view === v;
            return (
              <button
                key={v}
                role="tab"
                aria-selected={selected}
                onClick={() => void setView(v)}
                className={cn(
                  "relative flex h-full items-center gap-1.5 rounded-md px-3 text-[13px] capitalize transition-colors duration-200",
                  selected
                    ? "text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {selected && (
                  // The one tab indicator: an ink pill sliding to the clicked tab.
                  <motion.span
                    layoutId="view-pill"
                    className="absolute inset-0 rounded-md bg-foreground"
                  />
                )}
                <Icon className="relative size-3.5" />
                <span className="relative">{v}</span>
              </button>
            );
          })}
        </div>

        <Button onClick={() => openNew()} className="h-9 px-3.5">
          <Plus />
          Add job
          <kbd className="ml-1 rounded border border-primary-foreground/20 px-1 font-mono text-[11px] leading-4 opacity-70">
            N
          </kbd>
        </Button>
      </header>

      {/* Re-keyed per view so the CSS entrance replays when switching board ↔ list. */}
      <div
        key={view}
        className="min-h-0 flex-1 animate-in overflow-y-auto duration-200 fade-in-0 slide-in-from-bottom-1"
      >
        {view === "board" ? (
          <BoardView
            statuses={statuses}
            jobs={visible}
            onMove={move}
            onOpen={openJobById}
            onAdd={openNew}
          />
        ) : (
          <ListView
            statuses={statuses}
            jobs={visible}
            onOpen={openJobById}
            onStatusChange={changeStatus}
          />
        )}
      </div>

      <JobFormDialog
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        statuses={statuses}
        job={form.job}
        defaultStatusId={form.statusId}
      />

      <JobSheet
        job={openJob}
        statuses={statuses}
        open={Boolean(openJob)}
        onOpenChange={(open) => !open && void setOpenId(null)}
        onStatusChange={changeStatus}
        onEdit={(job) => setForm({ open: true, job })}
        onArchive={archive}
        onDelete={setConfirmDelete}
      />

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this job?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.title} at {confirmDelete?.company} and its
              timeline will be removed for good. Archive it instead if you might
              need it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              {deleting && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
