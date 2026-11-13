"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobApplication } from "@/server/jobs/queries";

const OUTCOME = {
  applied: [
    "Applied",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  ],
  prepared: ["Ready to apply", "bg-sky-500/15 text-sky-700 dark:text-sky-300"],
  failed: ["Could not apply", "bg-red-500/15 text-red-700 dark:text-red-300"],
  needs_input: [
    "Needs your input",
    "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ],
} as const;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Couldn't copy. Select the text instead.");
        }
      }}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

/** What was (or is ready to be) submitted for each attempt, recorded by Claude through the connector. */
export function ApplicationsSection({ list }: { list: JobApplication[] }) {
  return (
    <ul className="space-y-3">
      {list.map((a) => {
        const [label, tone] = OUTCOME[a.outcome];
        const ready = a.outcome === "prepared";
        return (
          <li key={a.id} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  tone,
                )}
              >
                {label}
              </span>
              <span className="font-medium">{a.platform}</span>
              <span className="text-muted-foreground text-xs">
                {new Date(a.createdAt).toLocaleString()}
              </span>
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 text-xs underline underline-offset-2"
                >
                  Open form <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            {a.resumeTitle && (
              <p className="text-muted-foreground mt-1.5 text-xs">
                Resume:{" "}
                {a.resumeId ? (
                  <Link
                    href={`/app/resumes/${a.resumeId}`}
                    className="underline underline-offset-2"
                  >
                    {a.resumeTitle}
                  </Link>
                ) : (
                  a.resumeTitle
                )}
              </p>
            )}
            {a.failureReason && (
              <p className="mt-1.5 text-xs">{a.failureReason}</p>
            )}
            {a.notes && (
              <p className="text-muted-foreground mt-1.5 text-xs">{a.notes}</p>
            )}
            {a.submitted.length > 0 && (
              <details className="mt-2" open={ready}>
                <summary className="text-muted-foreground cursor-pointer text-xs">
                  {ready ? "Ready to copy" : "What was submitted"} (
                  {a.submitted.length})
                </summary>
                <dl className="mt-2 space-y-2">
                  {a.submitted.map((f, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <dt className="text-muted-foreground text-xs">
                          {f.field}
                        </dt>
                        {f.missing || !f.value ? (
                          <dd className="text-sm text-amber-700 dark:text-amber-300">
                            Needs your answer
                          </dd>
                        ) : (
                          <dd className="text-sm whitespace-pre-wrap">
                            {f.value}
                          </dd>
                        )}
                      </div>
                      {f.value && !f.missing && (
                        <CopyButton text={f.value} label={f.field} />
                      )}
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
