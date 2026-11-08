"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Focus,
  Link2,
  Lock,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLAN_LABELS, type PlanKind } from "@/lib/prep";
import type { PlanView } from "@/server/prep/queries";
import {
  regenerateShareLink,
  setPlanVisibility,
  setProgress,
} from "@/server/prep/actions";

type State = "done" | "confident" | "revise";
type Item = PlanView["items"][number];

const STATE_META: Record<
  State,
  { label: string; key: string; className: string }
> = {
  done: {
    label: "Done",
    key: "1",
    className: "text-sky-600 dark:text-sky-400",
  },
  confident: {
    label: "Confident",
    key: "2",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  revise: {
    label: "Revise",
    key: "3",
    className: "text-amber-600 dark:text-amber-400",
  },
};

const fmtMin = (m: number) =>
  m >= 60
    ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`
    : `${m} min`;

export function PrepWorkspace({
  view,
  mode,
  canTrack,
}: {
  view: PlanView;
  /** owner: full controls; shared: read-only plan, own progress if signed in. */
  mode: "owner" | "shared";
  canTrack: boolean;
}) {
  const [progress, setLocal] = useState<Record<string, string>>(view.progress);
  const [focus, setFocus] = useState<number | null>(null);
  const kind = view.plan.kind as PlanKind;

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of view.items) {
      const key =
        kind === "full"
          ? it.topic
          : kind === "crash"
            ? "Today"
            : `Day ${it.day}`;
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return [...map.entries()];
  }, [view.items, kind]);

  const total = view.items.length;
  const done = view.items.filter(
    (i) => progress[i.id] === "done" || progress[i.id] === "confident",
  ).length;
  const minutes = view.items.reduce((s, i) => s + i.estMinutes, 0);
  const revise = view.items.filter((i) => progress[i.id] === "revise").length;

  const mark = useCallback(
    async (questionId: string, state: State | null) => {
      if (!canTrack) return void toast("Sign in to track your progress");
      const prev = progress[questionId];
      setLocal((p) => {
        const n = { ...p };
        if (state) n[questionId] = state;
        else delete n[questionId];
        return n;
      });
      const res = await setProgress(view.plan.id, questionId, state);
      if (!res.ok) {
        setLocal((p) => ({ ...p, [questionId]: prev }));
        toast.error(res.error);
      }
    },
    [canTrack, progress, view.plan.id],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end gap-4">
        <div className="mr-auto min-w-0">
          <p className="text-sm text-muted-foreground">
            {view.company} · {view.title}
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-[-0.03em]">
            {kind === "multiday"
              ? `${view.plan.days}-day plan`
              : PLAN_LABELS[kind]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{total}</span> questions
            ·{" "}
            <span className="font-mono text-foreground">{fmtMin(minutes)}</span>{" "}
            of study
            {kind === "multiday" && (
              <>
                {" "}
                · the last day is for questions you mark &ldquo;Revise&rdquo;
              </>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setFocus(0)}
          disabled={total === 0}
        >
          <Focus /> Focus mode
        </Button>
        {mode === "owner" && <ShareControl view={view} />}
      </header>

      {canTrack && total > 0 && (
        <div>
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>
              {done} of {total} done{revise ? ` · ${revise} to revise` : ""}
            </span>
            <span className="font-mono">
              {Math.round((done / total) * 100)}%
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemax={total}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {total === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          This plan is empty. Regenerate it from the job after adding skills.
        </p>
      ) : (
        groups.map(([group, items]) => (
          <section key={group}>
            <h2 className="mb-2 flex items-baseline gap-2 text-sm font-medium">
              {group}
              <span className="font-normal text-muted-foreground">
                · {items.length} ·{" "}
                {fmtMin(items.reduce((s, i) => s + i.estMinutes, 0))}
              </span>
            </h2>
            <ul className="divide-y rounded-2xl border bg-card">
              {items.map((it) => (
                <QuestionRow
                  key={it.id}
                  item={it}
                  state={progress[it.id] as State | undefined}
                  onMark={(s) => mark(it.id, s)}
                  onFocus={() => setFocus(view.items.indexOf(it))}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {focus !== null && (
        <FocusMode
          items={view.items}
          index={focus}
          setIndex={setFocus}
          progress={progress}
          onMark={mark}
          onClose={() => setFocus(null)}
        />
      )}
    </div>
  );
}

function StateButtons({
  state,
  onMark,
  size = "xs",
}: {
  state?: State;
  onMark: (s: State | null) => void;
  size?: "xs" | "sm";
}) {
  return (
    <div className="flex gap-1">
      {(Object.keys(STATE_META) as State[]).map((s) => (
        <Button
          key={s}
          type="button"
          size={size}
          variant={state === s ? "secondary" : "ghost"}
          aria-pressed={state === s}
          onClick={() => onMark(state === s ? null : s)}
          className={cn(state === s && STATE_META[s].className)}
        >
          {state === s && <Check />}
          {STATE_META[s].label}
        </Button>
      ))}
    </div>
  );
}

function QuestionRow({
  item,
  state,
  onMark,
  onFocus,
}: {
  item: Item;
  state?: State;
  onMark: (s: State | null) => void;
  onFocus: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-7 shrink-0 font-mono text-xs text-brand">
          {item.priority}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <span
            className={cn(
              "block text-sm font-medium",
              (state === "done" || state === "confident") &&
                "text-muted-foreground",
            )}
          >
            {item.question}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {[
              item.subtopic || item.topic,
              item.difficulty,
              `${item.estMinutes} min`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </button>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </div>
      {open && (
        <div className="mt-3 ml-10 space-y-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {item.answer}
          </p>
          {item.references.length > 0 && (
            <ul className="space-y-0.5 text-xs">
              {item.references.map((r) => (
                <li key={r}>
                  <a
                    href={r}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    {r.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <StateButtons state={state} onMark={onMark} />
            <Button
              size="xs"
              variant="ghost"
              className="ml-auto text-muted-foreground"
              onClick={onFocus}
            >
              <Focus /> Practise
            </Button>
          </div>
        </div>
      )}
      {!open && state && (
        <p className={cn("mt-1 ml-10 text-xs", STATE_META[state].className)}>
          {STATE_META[state].label}
        </p>
      )}
    </li>
  );
}

/** One question at a time: recall first, then reveal. Keys: Space reveal, 1/2/3 mark, ←/→ move, Esc close. */
function FocusMode({
  items,
  index,
  setIndex,
  progress,
  onMark,
  onClose,
}: {
  items: Item[];
  index: number;
  setIndex: (i: number) => void;
  progress: Record<string, string>;
  onMark: (id: string, s: State | null) => void;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const item = items[index];
  const state = progress[item.id] as State | undefined;

  const go = useCallback(
    (d: number) => {
      const next = Math.min(items.length - 1, Math.max(0, index + d));
      if (next !== index) {
        setRevealed(false);
        setIndex(next);
      }
    },
    [index, items.length, setIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setRevealed((r) => !r);
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (["1", "2", "3"].includes(e.key)) {
        const s = (Object.keys(STATE_META) as State[])[Number(e.key) - 1];
        onMark(item.id, state === s ? null : s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, item.id, onClose, onMark, state]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal
      aria-label="Focus mode"
    >
      <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
        <span className="font-mono text-xs text-muted-foreground">
          {index + 1} / {items.length}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Space to reveal · 1 2 3 to mark · ← → to move · Esc to close
        </span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </header>
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
          <p className="font-mono text-xs text-brand">
            {item.priority} · {item.subtopic || item.topic} · {item.estMinutes}{" "}
            min
          </p>
          <h2 className="mt-3 text-2xl leading-snug font-medium tracking-[-0.02em]">
            {item.question}
          </h2>
          {revealed ? (
            <p className="mt-8 leading-relaxed whitespace-pre-wrap text-foreground/90">
              {item.answer}
            </p>
          ) : (
            <Button
              variant="outline"
              className="mt-8"
              onClick={() => setRevealed(true)}
            >
              <Eye /> Reveal answer
            </Button>
          )}
        </div>
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t px-4 py-3 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(-1)}
          disabled={index === 0}
        >
          <ArrowLeft /> Previous
        </Button>
        <div className="mx-auto">
          <StateButtons
            state={state}
            onMark={(s) => onMark(item.id, s)}
            size="sm"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(1)}
          disabled={index === items.length - 1}
        >
          Next <ArrowRight />
        </Button>
      </footer>
    </div>
  );
}

function ShareControl({ view }: { view: PlanView }) {
  const link = (t: string) => `${window.location.origin}/p/${t}`;
  const [visibility, setVis] = useState(view.plan.visibility);
  const [token, setToken] = useState(
    view.plan.visibility === "link" ? view.plan.shareToken : null,
  );

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-surface p-0.5">
      <Button
        size="sm"
        variant={visibility === "private" ? "secondary" : "ghost"}
        onClick={async () => {
          const res = await setPlanVisibility(view.plan.id, "private");
          if (!res.ok) return void toast.error(res.error);
          setVis("private");
          setToken(null);
          toast("Only you can open this plan now");
        }}
      >
        <Lock /> Private
      </Button>
      <Button
        size="sm"
        variant={visibility === "link" ? "secondary" : "ghost"}
        onClick={async () => {
          const res = await setPlanVisibility(view.plan.id, "link");
          if (!res.ok) return void toast.error(res.error);
          setVis("link");
          setToken(res.data.token);
          if (res.data.token)
            await navigator.clipboard
              .writeText(link(res.data.token))
              .catch(() => {});
          toast.success("Link copied. Anyone with it can view this plan.");
        }}
      >
        <Link2 /> Anyone with link
      </Button>
      {token && (
        <>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Copy link"
            onClick={async () => {
              await navigator.clipboard.writeText(link(token));
              toast("Link copied");
            }}
          >
            <Copy />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Make a new link (the old one stops working)"
            title="New link"
            onClick={async () => {
              const res = await regenerateShareLink(view.plan.id);
              if (!res.ok) return void toast.error(res.error);
              setToken(res.data.token);
              await navigator.clipboard
                .writeText(link(res.data.token))
                .catch(() => {});
              toast("New link copied; the old one no longer works");
            }}
          >
            <RefreshCw />
          </Button>
        </>
      )}
    </div>
  );
}

/** The drawer section: create plans, or open one. */
export function JobPrepSection({
  jobId,
  plans,
  suggested,
  onGenerate,
  generating,
}: {
  jobId: string;
  plans: {
    id: string;
    kind: string;
    days: number;
    total: number;
    minutes: number;
    done: number;
  }[];
  suggested: PlanKind;
  onGenerate: () => void;
  generating: boolean;
}) {
  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4">
        <p className="text-sm">
          Questions from the curated bank, matched to this job&rsquo;s skills: a
          1-day plan, a multi-day plan and the full curriculum.
        </p>
        <Button
          size="sm"
          className="mt-3"
          onClick={onGenerate}
          disabled={generating}
        >
          <Sparkles /> {generating ? "Building plans" : "Build prep plans"}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2" data-job={jobId}>
      {plans.map((p) => {
        const kind = p.kind as PlanKind;
        return (
          <Link
            key={p.id}
            href={`/app/prep/${p.id}`}
            className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-surface"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                {kind === "multiday" ? `${p.days}-day plan` : PLAN_LABELS[kind]}
                {kind === suggested && (
                  <span className="rounded bg-primary/15 px-1.5 py-px text-[10px] font-medium text-brand">
                    Suggested
                  </span>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">
                {p.total} questions · {fmtMin(p.minutes)}
                {p.done ? ` · ${p.done} done` : ""}
              </span>
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        );
      })}
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground"
        onClick={onGenerate}
        disabled={generating}
      >
        <RotateCcw />{" "}
        {generating ? "Rebuilding" : "Rebuild from current skills"}
      </Button>
    </div>
  );
}
