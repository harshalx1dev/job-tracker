"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Pencil, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_ANSWER, type QuestionUpdate } from "@/lib/profile-questions";
import type { ProfileQuestion } from "@/server/db/schema";
import {
  suggestQuestions,
  updateQuestion,
} from "@/server/profile/question-actions";

/**
 * "Questions for you": the AI asks about gaps in the profile; each question is
 * answered, skipped ("Not relevant", "No idea") or reopened on its own. Answered
 * ones feed every AI feature. The list is kept here, not refetched, so working
 * on it never disturbs unsaved edits in the profile form.
 */
export function ProfileQuestions({
  initial,
  aiReady,
}: {
  initial: ProfileQuestion[];
  aiReady: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [suggesting, startSuggest] = useTransition();

  const pending = rows.filter((r) => r.status === "pending").reverse(); // oldest first
  const answered = rows.filter((r) => r.status === "answered");
  const skipped = rows.filter(
    (r) => r.status === "na" || r.status === "unsure",
  );
  const replace = (row: ProfileQuestion) =>
    setRows((rs) => rs.map((r) => (r.id === row.id ? row : r)));

  function suggest() {
    startSuggest(async () => {
      const res = await suggestQuestions();
      if (!res.ok) return void toast.error(res.error);
      setRows((rs) => [...res.data, ...rs]);
      toast.success(
        res.data.length === 1
          ? "1 new question"
          : `${res.data.length} new questions`,
      );
    });
  }

  return (
    <section id="questions" className="scroll-mt-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Questions for you</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Short questions about your work, so the AI knows more than your
            resume says. Answer what you can: your answers shape your match
            scores, outreach and drafted answers. Skip anything that
            doesn&apos;t apply.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={suggest}
          disabled={suggesting || !aiReady}
        >
          {suggesting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Suggest questions
        </Button>
      </div>
      {!aiReady && (
        <p className="text-xs text-muted-foreground">
          Suggesting questions needs a Gemini key.{" "}
          <Link className="underline underline-offset-4" href="/app/settings">
            Connect one in Settings
          </Link>
          .
        </p>
      )}

      {pending.length > 0 && (
        <ul className="space-y-3">
          {pending.map((q) => (
            <li key={q.id}>
              <PendingQuestion row={q} onChange={replace} />
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No questions yet. Use &ldquo;Suggest questions&rdquo; to get a first
          few based on your profile.
        </p>
      )}
      {rows.length > 0 && pending.length === 0 && (
        <p className="text-sm text-muted-foreground">
          All caught up. Suggest more whenever you like.
        </p>
      )}

      {answered.length > 0 && (
        <details className="group rounded-xl border">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium select-none">
            Answered ({answered.length})
          </summary>
          <ul className="divide-y border-t">
            {answered.map((q) => (
              <li key={q.id}>
                <AnsweredQuestion row={q} onChange={replace} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {skipped.length > 0 && (
        <details className="group rounded-xl border">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium select-none">
            Skipped ({skipped.length})
          </summary>
          <ul className="divide-y border-t">
            {skipped.map((q) => (
              <li key={q.id}>
                <SkippedQuestion row={q} onChange={replace} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Runs one change for one question; reports a failure without touching anything else. */
function useQuestionUpdate(
  row: ProfileQuestion,
  onChange: (r: ProfileQuestion) => void,
) {
  const [busy, start] = useTransition();
  const run = (update: QuestionUpdate, then?: () => void) =>
    start(async () => {
      const res = await updateQuestion(row.id, update);
      if (!res.ok) return void toast.error(res.error);
      onChange(res.data);
      then?.();
    });
  return { busy, run };
}

function About({ row }: { row: ProfileQuestion }) {
  return row.about ? (
    <span className="mb-1 inline-block rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {row.about}
    </span>
  ) : null;
}

function PendingQuestion({
  row,
  onChange,
}: {
  row: ProfileQuestion;
  onChange: (r: ProfileQuestion) => void;
}) {
  const [draft, setDraft] = useState("");
  const { busy, run } = useQuestionUpdate(row, onChange);
  return (
    <div className="rounded-xl border bg-card p-4">
      <About row={row} />
      <p className="text-sm font-medium">{row.question}</p>
      <Textarea
        className="mt-3"
        rows={3}
        maxLength={MAX_ANSWER}
        placeholder="Your answer"
        aria-label={`Answer: ${row.question}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={busy}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={busy || !draft.trim()}
          onClick={() => run({ status: "answered", answer: draft })}
        >
          {busy && <Loader2 className="animate-spin" />}
          Submit answer
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          title="This doesn't apply to me"
          onClick={() => run({ status: "na" })}
        >
          Not relevant
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          title="I don't know or don't remember"
          onClick={() => run({ status: "unsure" })}
        >
          No idea
        </Button>
      </div>
    </div>
  );
}

function AnsweredQuestion({
  row,
  onChange,
}: {
  row: ProfileQuestion;
  onChange: (r: ProfileQuestion) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.answer ?? "");
  const { busy, run } = useQuestionUpdate(row, onChange);
  return (
    <div className="px-4 py-3">
      <About row={row} />
      <p className="text-sm font-medium">{row.question}</p>
      {editing ? (
        <>
          <Textarea
            className="mt-2"
            rows={3}
            maxLength={MAX_ANSWER}
            aria-label={`Answer: ${row.question}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={busy || !draft.trim()}
              onClick={() =>
                run({ status: "answered", answer: draft }, () =>
                  setEditing(false),
                )
              }
            >
              {busy && <Loader2 className="animate-spin" />}
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setDraft(row.answer ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-1 flex items-start justify-between gap-3">
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {row.answer}
          </p>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Edit answer"
            title="Edit answer"
            onClick={() => {
              setDraft(row.answer ?? "");
              setEditing(true);
            }}
          >
            <Pencil />
          </Button>
        </div>
      )}
    </div>
  );
}

function SkippedQuestion({
  row,
  onChange,
}: {
  row: ProfileQuestion;
  onChange: (r: ProfileQuestion) => void;
}) {
  const { busy, run } = useQuestionUpdate(row, onChange);
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div>
        <About row={row} />
        <p className="text-sm">{row.question}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {row.status === "na" ? "Not relevant" : "No idea"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => run({ status: "pending" })}
      >
        {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
        Answer now
      </Button>
    </div>
  );
}
