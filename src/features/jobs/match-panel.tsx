"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";
import type { JobMatch } from "@/lib/ai-schemas";
import { aiMatchJob } from "@/server/ai/job-actions";

function band(score: number) {
  if (score >= 85)
    return {
      label: "Strong fit",
      tone: "text-emerald-600 dark:text-emerald-400",
    };
  if (score >= 65)
    return { label: "Good fit", tone: "text-sky-600 dark:text-sky-400" };
  if (score >= 40)
    return { label: "Partial fit", tone: "text-amber-600 dark:text-amber-400" };
  return { label: "Weak fit", tone: "text-rose-600 dark:text-rose-400" };
}

export function MatchPanel({
  jobId,
  match,
}: {
  jobId: string;
  match: JobMatch | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = () =>
    start(async () => {
      const res = await aiMatchJob(jobId);
      if (!res.ok) {
        toast.error(
          res.error,
          res.code === "KEY_REQUIRED"
            ? {
                action: {
                  label: "Settings",
                  onClick: () => router.push("/app/settings"),
                },
              }
            : res.error.includes("profile")
              ? {
                  action: {
                    label: "Profile",
                    onClick: () => router.push("/app/profile"),
                  },
                }
              : undefined,
        );
      }
    });

  if (!match) {
    return (
      <div className="rounded-xl border border-dashed p-4">
        <p className="text-sm">
          See how your profile fits this job: what matches, what&rsquo;s missing
          and what to change.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={run} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pending ? "Checking fit" : "Check my fit"}
          </Button>
          <Link
            href="/app/profile"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Uses your profile
          </Link>
        </div>
      </div>
    );
  }

  const b = band(match.score);
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-opacity",
        pending && "opacity-60",
      )}
    >
      <div className="flex items-start gap-4">
        {/* The score as a figure; the label carries the meaning, not colour alone. */}
        <div className="shrink-0 text-center">
          <p className="font-mono text-3xl font-medium tracking-[-0.03em] tabular">
            {match.score}
          </p>
          <p className={cn("text-xs font-medium", b.tone)}>{b.label}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm">{match.verdict}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Checked <RelativeTime date={match.at} />
          </p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={run}
          disabled={pending}
          aria-label="Check again"
        >
          {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </div>

      {(match.matched.length > 0 || match.missing.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ChipList
            title="You have"
            items={match.matched}
            icon={<Check className="size-3 text-emerald-500" />}
          />
          <ChipList
            title="Not shown"
            items={match.missing}
            icon={<Minus className="size-3 text-amber-500" />}
          />
        </div>
      )}

      {match.suggestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Tailor your resume
          </p>
          <ul className="space-y-1.5 text-sm">
            {match.suggestions.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-foreground/50" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChipList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {title}
      </p>
      <ul className="flex flex-wrap gap-1">
        {items.map((m) => (
          <li
            key={m}
            className="inline-flex items-center gap-1 rounded-md border bg-surface px-1.5 py-0.5 text-xs"
          >
            {icon}
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}
