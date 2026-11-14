"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { isMissing } from "@/lib/apply-readiness";
import { cn } from "@/lib/utils";
import type { JobApplication } from "@/server/jobs/queries";
import { savePreparedFields } from "@/server/jobs/apply-actions";

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

type Fields = JobApplication["submitted"];

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

/** Prepared answers: the user fills in what's missing and corrects the rest, then saves. */
function PreparedEditor({
  application,
  onSaved,
}: {
  application: JobApplication;
  onSaved: (id: string, submitted: Fields) => void;
}) {
  const [values, setValues] = useState(
    application.submitted.map((f) => f.value),
  );
  const [pending, start] = useTransition();
  const dirty = values.some((v, i) => v !== application.submitted[i].value);
  const missing = application.submitted.filter(isMissing).length;

  function save() {
    const fields = application.submitted.map((f, i) => ({
      field: f.field,
      value: values[i],
    }));
    start(async () => {
      const res = await savePreparedFields(application.id, fields);
      if (!res.ok) return void toast.error(res.error);
      onSaved(application.id, res.data.submitted);
      toast.success("Answers saved");
    });
  }

  return (
    <div className="mt-2 space-y-3">
      <p className="text-muted-foreground text-xs">
        {missing
          ? `${missing} still need${missing === 1 ? "s" : ""} your answer. Claude won't apply until they're filled in.`
          : "Every answer is filled in. Edit anything that isn't right."}
      </p>
      {application.submitted.map((f, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`${application.id}-${i}`}
              className="text-muted-foreground text-xs"
            >
              {f.field}
              {!values[i].trim() && (
                <span className="ml-2 text-amber-700 dark:text-amber-300">
                  Needs your answer
                </span>
              )}
            </label>
            {values[i].trim() && (
              <CopyButton text={values[i]} label={f.field} />
            )}
          </div>
          <Textarea
            id={`${application.id}-${i}`}
            value={values[i]}
            rows={2}
            onChange={(e) =>
              setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))
            }
          />
        </div>
      ))}
      {dirty && (
        <Button type="button" size="sm" disabled={pending} onClick={save}>
          {pending && <Loader2 className="animate-spin" />}
          Save answers
        </Button>
      )}
    </div>
  );
}

/** What was (or is ready to be) submitted for each attempt, recorded by Claude through the connector. */
export function ApplicationsSection({
  list,
  onSaved,
}: {
  list: JobApplication[];
  onSaved: (id: string, submitted: Fields) => void;
}) {
  return (
    <ul className="space-y-3">
      {list.map((a) => {
        const [label, tone] = OUTCOME[a.outcome];
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
            {a.outcome === "prepared" ? (
              <PreparedEditor application={a} onSaved={onSaved} />
            ) : (
              a.submitted.length > 0 && (
                <details className="mt-2">
                  <summary className="text-muted-foreground cursor-pointer text-xs">
                    What was submitted ({a.submitted.length})
                  </summary>
                  <dl className="mt-2 space-y-2">
                    {a.submitted.map((f, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <div className="min-w-0 flex-1">
                          <dt className="text-muted-foreground text-xs">
                            {f.field}
                          </dt>
                          <dd className="text-sm whitespace-pre-wrap">
                            {f.value || "—"}
                          </dd>
                        </div>
                        {f.value && (
                          <CopyButton text={f.value} label={f.field} />
                        )}
                      </div>
                    ))}
                  </dl>
                </details>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
