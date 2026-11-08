"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";
import { wordCount } from "@/lib/outreach";
import {
  deleteAnswer,
  draftAnswerAction,
  findSimilarAnswers,
  saveAnswer,
  type SimilarAnswer,
} from "@/server/ai/answer-actions";
import { JobPicker, KeyHint, type JobOption } from "./job-picker";

export type AnswerRow = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  jobId: string | null;
  wordLimit: number | null;
  updatedAt: Date;
};

type Draft = {
  id?: string;
  question: string;
  answer: string;
  tags: string;
  jobId: string;
  wordLimit: string;
  context: string;
};

const EMPTY: Draft = {
  question: "",
  answer: "",
  tags: "",
  jobId: "",
  wordLimit: "",
  context: "",
};

export function AnswersStudio({
  jobs,
  saved,
  aiReady,
}: {
  jobs: JobOption[];
  saved: AnswerRow[];
  aiReady: boolean;
}) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [similar, setSimilar] = useState<SimilarAnswer[] | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [finding, startFind] = useTransition();
  const [drafting, startDraft] = useTransition();
  const [saving, startSave] = useTransition();
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const limit = Number(d.wordLimit) || undefined;
  const words = wordCount(d.answer);

  const find = () =>
    startFind(async () => {
      const res = await findSimilarAnswers(d.question);
      if (!res.ok) return void toast.error(res.error);
      setSimilar(res.data);
      if (res.data.length === 0) toast("No similar saved answers yet");
    });

  const draft = () =>
    startDraft(async () => {
      const res = await draftAnswerAction({
        question: d.question,
        jobId: d.jobId || undefined,
        wordLimit: limit,
        context: d.context || undefined,
        baseAnswerId: baseId ?? undefined,
      });
      if (!res.ok) return void toast.error(res.error);
      set({ answer: res.data.answer });
    });

  const save = () =>
    startSave(async () => {
      const res = await saveAnswer({
        id: d.id,
        question: d.question,
        answer: d.answer,
        tags: d.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        jobId: d.jobId || undefined,
        wordLimit: limit,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(
        res.data.searchable
          ? "Answer saved"
          : "Saved (it becomes searchable once a Gemini key is connected)",
      );
      setD(EMPTY);
      setSimilar(null);
      setBaseId(null);
    });

  return (
    <div className="space-y-10">
      <KeyHint show={!aiReady} />

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">
            {d.id ? "Edit answer" : "New answer"}
          </h2>
          {(d.id || d.question) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setD(EMPTY);
                setSimilar(null);
                setBaseId(null);
              }}
            >
              <X /> Clear
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Question from the application
              </span>
              <Textarea
                rows={3}
                value={d.question}
                onChange={(e) => {
                  set({ question: e.target.value });
                  setSimilar(null);
                }}
                placeholder="Tell us about a React project you're proud of."
              />
            </label>
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <label className="block space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">
                  For job
                </span>
                <JobPicker
                  jobs={jobs}
                  value={d.jobId}
                  onChange={(jobId) => set({ jobId })}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">
                  Word limit
                </span>
                <Input
                  inputMode="numeric"
                  value={d.wordLimit}
                  onChange={(e) =>
                    set({
                      wordLimit: e.target.value.replace(/\D/g, "").slice(0, 4),
                    })
                  }
                  placeholder="150"
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Anything to include (optional)
              </span>
              <Textarea
                rows={2}
                value={d.context}
                onChange={(e) => set({ context: e.target.value })}
                placeholder="Mention the accessibility audit I led."
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={find}
                disabled={!aiReady || finding || d.question.trim().length < 8}
              >
                {finding ? <Loader2 className="animate-spin" /> : <Search />}
                Find similar answers
              </Button>
              <Button
                size="sm"
                onClick={draft}
                disabled={!aiReady || drafting || d.question.trim().length < 8}
              >
                {drafting ? (
                  <Loader2 className="animate-spin" />
                ) : baseId ? (
                  <Wand2 />
                ) : (
                  <Sparkles />
                )}
                {drafting
                  ? "Drafting"
                  : baseId
                    ? "Adapt chosen answer"
                    : "Draft with AI"}
              </Button>
            </div>

            {similar && similar.length > 0 && (
              <ul className="space-y-2">
                {similar.map((s) => (
                  <li
                    key={s.id}
                    className={cn(
                      "rounded-xl border p-3 text-sm",
                      baseId === s.id && "border-foreground/40 bg-surface",
                    )}
                  >
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">
                        {Math.round(s.score * 100)}% similar
                      </span>
                    </p>
                    <p className="mt-1 font-medium">{s.question}</p>
                    <p className="mt-1 line-clamp-3 text-muted-foreground">
                      {s.answer}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="xs"
                        variant={baseId === s.id ? "default" : "outline"}
                        onClick={() => setBaseId(baseId === s.id ? null : s.id)}
                      >
                        {baseId === s.id ? <Check /> : <Wand2 />}
                        {baseId === s.id ? "Will adapt this" : "Adapt this one"}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => set({ answer: s.answer })}
                      >
                        Use as is
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="flex items-baseline justify-between text-xs font-medium text-muted-foreground">
                Answer
                <span
                  className={cn(
                    "font-mono tabular",
                    limit && words > limit && "text-destructive",
                  )}
                >
                  {words}
                  {limit ? ` / ${limit}` : ""} words
                </span>
              </span>
              <Textarea
                rows={12}
                value={d.answer}
                onChange={(e) => set({ answer: e.target.value })}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Tags (comma separated)
              </span>
              <Input
                value={d.tags}
                onChange={(e) => set({ tags: e.target.value })}
                placeholder="motivation, react, leadership"
              />
            </label>
            <div className="flex justify-end">
              <Button
                onClick={save}
                disabled={saving || !d.question.trim() || !d.answer.trim()}
              >
                {saving && <Loader2 className="animate-spin" />}
                {d.id ? "Save changes" : "Save to answer bank"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Library
        saved={saved}
        onEdit={(a) => {
          setD({
            id: a.id,
            question: a.question,
            answer: a.answer,
            tags: a.tags.join(", "),
            jobId: a.jobId ?? "",
            wordLimit: a.wordLimit ? String(a.wordLimit) : "",
            context: "",
          });
          setSimilar(null);
          setBaseId(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}

function Library({
  saved,
  onEdit,
}: {
  saved: AnswerRow[];
  onEdit: (a: AnswerRow) => void;
}) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(
    () => Array.from(new Set(saved.flatMap((a) => a.tags))).sort(),
    [saved],
  );
  const shown = saved.filter(
    (a) =>
      (!tag || a.tags.includes(tag)) &&
      (!q ||
        `${a.question} ${a.answer}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-medium">
          Answer bank{" "}
          <span className="font-normal text-muted-foreground">
            · {saved.length}
          </span>
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search answers"
            className="h-8 pl-8"
            aria-label="Search answers"
          />
        </div>
      </div>
      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? null : t)}
              className={cn(
                "h-6 rounded-md border px-2 text-xs transition-colors",
                tag === t
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {saved.length
            ? "No answers match."
            : "Answers you save appear here, ready to reuse."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((a) => (
            <li
              key={a.id}
              className="group flex flex-col rounded-2xl border bg-card p-4"
            >
              <p className="font-medium">{a.question}</p>
              <p className="mt-2 line-clamp-4 flex-1 text-sm text-muted-foreground">
                {a.answer}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {wordCount(a.answer)} words ·{" "}
                  <RelativeTime date={a.updatedAt} />
                </span>
                <span className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy answer"
                    onClick={async () => {
                      await navigator.clipboard.writeText(a.answer);
                      toast("Copied");
                    }}
                  >
                    <Copy />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit answer"
                    onClick={() => onEdit(a)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete answer"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteAnswer(a.id)}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </div>
              {a.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
