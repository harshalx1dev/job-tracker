"use client";

import { useState, useTransition } from "react";
import {
  Bookmark,
  Check,
  Copy,
  Loader2,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";
import {
  CHANNELS,
  TONES,
  limitsFor,
  type ChannelId,
  type OutreachDraft,
  type ToneId,
} from "@/lib/outreach";
import type { OutreachMessage } from "@/server/db/schema";
import {
  deleteOutreach,
  generateOutreachAction,
  saveOutreach,
  toggleOutreachFavorite,
} from "@/server/ai/outreach-actions";
import { JobPicker, KeyHint, type JobOption } from "./job-picker";

export function OutreachStudio({
  jobs,
  saved,
  aiReady,
}: {
  jobs: JobOption[];
  saved: OutreachMessage[];
  aiReady: boolean;
}) {
  const [channel, setChannel] = useState<ChannelId>("email");
  const [tone, setTone] = useState<ToneId>("warm");
  const [premium, setPremium] = useState(false);
  const [jobId, setJobId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientRole, setRecipientRole] = useState("");
  const [goal, setGoal] = useState("");
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [pending, start] = useTransition();
  const limits = limitsFor(channel, premium);

  function generate() {
    start(async () => {
      const res = await generateOutreachAction({
        channel,
        tone,
        premium,
        jobId: jobId || undefined,
        recipientName: recipientName || undefined,
        recipientRole: recipientRole || undefined,
        goal: goal || undefined,
      });
      if (!res.ok) return void toast.error(res.error);
      setDrafts(res.data);
    });
  }

  return (
    <div className="space-y-10">
      <KeyHint show={!aiReady} />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <form
          className="space-y-5 rounded-2xl border bg-card p-5 lg:self-start"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted-foreground">
              Channel
            </legend>
            <div className="grid gap-1.5">
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={channel === c.id}
                  onClick={() => {
                    setChannel(c.id);
                    setDrafts([]);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors hover:bg-surface",
                    channel === c.id && "border-foreground/40 bg-surface",
                  )}
                >
                  <span>
                    <span className="block text-sm">{c.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.note}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {c.id === "linkedin_note" && premium ? 300 : c.bodyMax}
                  </span>
                </button>
              ))}
            </div>
            {channel === "linkedin_note" && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={premium}
                  onChange={(e) => setPremium(e.target.checked)}
                />
                I have LinkedIn Premium (300 characters)
              </label>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted-foreground">
              Tone
            </legend>
            <div className="flex rounded-lg border bg-surface p-0.5">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tone === t.id}
                  onClick={() => setTone(t.id)}
                  className={cn(
                    "h-7 flex-1 rounded-md text-xs transition-colors",
                    tone === t.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">
              About this job
            </span>
            <JobPicker jobs={jobs} value={jobId} onChange={setJobId} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Recipient name
              </span>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Priya"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Their role
              </span>
              <Input
                value={recipientRole}
                onChange={(e) => setRecipientRole(e.target.value)}
                placeholder="Recruiter"
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">
              What do you want from it?
            </span>
            <Textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="A referral for the frontend role; I met them at React India."
            />
          </label>
          <Button
            type="submit"
            className="w-full"
            disabled={pending || !aiReady}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Writing 3 drafts" : "Write 3 drafts"}
          </Button>
        </form>

        <div className="space-y-3">
          {drafts.length === 0 ? (
            <div className="grid h-full min-h-60 place-items-center rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Drafts appear here, each with a different angle, all within the
              channel&rsquo;s limit.
            </div>
          ) : (
            drafts.map((d, i) => (
              <DraftCard
                key={`${i}:${d.angle}`}
                draft={d}
                limits={limits}
                onSave={async (subject, body) => {
                  const res = await saveOutreach({
                    channel,
                    tone,
                    jobId: jobId || undefined,
                    recipientName: recipientName || undefined,
                    subject: subject || undefined,
                    body,
                  });
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Saved to your messages");
                }}
              />
            ))
          )}
        </div>
      </div>

      <SavedMessages saved={saved} jobs={jobs} />
    </div>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return (
    <span
      className={cn(
        "font-mono text-xs tabular",
        n > max ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {n} / {max}
    </span>
  );
}

function DraftCard({
  draft,
  limits,
  onSave,
}: {
  draft: OutreachDraft;
  limits: { subjectMax: number; bodyMax: number };
  onSave: (subject: string, body: string) => Promise<void>;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <article className="rounded-2xl border bg-card p-4">
      <p className="mb-3 inline-flex rounded-md bg-surface px-2 py-0.5 text-xs text-muted-foreground">
        {draft.angle}
      </p>
      {limits.subjectMax > 0 && (
        <div className="mb-2">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Subject"
            className="font-medium"
          />
          <div className="mt-1 text-right">
            <Counter n={subject.length} max={limits.subjectMax} />
          </div>
        </div>
      )}
      <Textarea
        rows={Math.min(14, Math.max(4, Math.ceil(body.length / 70)))}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Message"
      />
      <div className="mt-2 flex items-center gap-2">
        <Counter n={body.length} max={limits.bodyMax} />
        <span className="ml-auto" />
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(
              subject ? `Subject: ${subject}\n\n${body}` : body,
            );
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(subject, body);
            setSaving(false);
          }}
        >
          {saving ? <Loader2 className="animate-spin" /> : <Bookmark />}
          Save
        </Button>
      </div>
    </article>
  );
}

function SavedMessages({
  saved,
  jobs,
}: {
  saved: OutreachMessage[];
  jobs: JobOption[];
}) {
  const [filter, setFilter] = useState<ChannelId | "all" | "starred">("all");
  const jobName = (id: string | null) => jobs.find((j) => j.id === id)?.company;
  const shown = saved.filter((m) =>
    filter === "all"
      ? true
      : filter === "starred"
        ? m.favorite
        : m.channel === filter,
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-medium">Saved messages</h2>
        {(["all", "starred", ...CHANNELS.map((c) => c.id)] as const).map(
          (f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                "h-7 rounded-md px-2.5 text-xs transition-colors",
                filter === f
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              {f === "all"
                ? "All"
                : f === "starred"
                  ? "Starred"
                  : CHANNELS.find((c) => c.id === f)!.label}
            </button>
          ),
        )}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing saved here yet.
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {shown.map((m) => (
            <li key={m.id} className="group flex gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {CHANNELS.find((c) => c.id === m.channel)?.label ?? m.channel}
                  {jobName(m.jobId) && ` · ${jobName(m.jobId)}`}
                  {m.recipientName && ` · to ${m.recipientName}`} ·{" "}
                  <RelativeTime date={m.createdAt} />
                </p>
                {m.subject && (
                  <p className="mt-1 truncate text-sm font-medium">
                    {m.subject}
                  </p>
                )}
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {m.body}
                </p>
              </div>
              <div className="flex shrink-0 items-start gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={m.favorite ? "Unstar" : "Star"}
                  onClick={() => toggleOutreachFavorite(m.id)}
                >
                  <Star
                    className={cn(m.favorite && "fill-current text-amber-500")}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy message"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      m.subject ? `Subject: ${m.subject}\n\n${m.body}` : m.body,
                    );
                    toast("Copied");
                  }}
                >
                  <Copy />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete message"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteOutreach(m.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
