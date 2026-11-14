"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { applyReadiness, READY_STAGE } from "@/lib/apply-readiness";
import { setApplyWithAi } from "@/server/jobs/apply-actions";
import type { JobApplication } from "@/server/jobs/queries";
import { ApplicationsSection } from "./applications-section";

type Fields = JobApplication["submitted"];

/**
 * The "Apply with AI" control and the answers Claude prepared. Claude only
 * applies to a job that is ticked here, sits in the Ready to apply stage, and
 * has every answer filled in (the same rule the connector uses).
 */
export function ApplyPanel({
  jobId,
  stageName,
  applyWithAi,
  initial,
}: {
  jobId: string;
  stageName: string;
  applyWithAi: boolean;
  initial: JobApplication[];
}) {
  const [on, setOn] = useState(applyWithAi);
  const [list, setList] = useState(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setList(initial);
  }

  const readiness = applyReadiness({
    applyWithAi: on,
    stageName,
    applications: list,
  });
  const checks = [
    { ok: on, text: "Apply with AI is ticked" },
    {
      ok: stageName.trim().toLowerCase() === READY_STAGE.toLowerCase(),
      text: `Stage is "${READY_STAGE}"`,
    },
    {
      ok: list.some((a) => a.outcome === "prepared"),
      text: "Answers are prepared",
    },
    {
      ok:
        readiness.missingFields.length === 0 &&
        list.some((a) => a.outcome === "prepared"),
      text: "Every answer is filled in",
    },
  ];

  async function toggle(next: boolean) {
    setOn(next);
    const res = await setApplyWithAi(jobId, next);
    if (!res.ok) {
      setOn(!next);
      toast.error(res.error);
    }
  }

  function saved(id: string, submitted: Fields) {
    setList((l) => l.map((a) => (a.id === id ? { ...a, submitted } : a)));
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <Checkbox
          checked={on}
          onCheckedChange={(v) => void toggle(v === true)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Apply with AI</span>
          <span className="text-muted-foreground mt-0.5 block text-xs">
            Claude submits this application the next time you run the apply
            command, once everything below is ready.
          </span>
        </span>
      </label>
      <ul className="space-y-1 text-xs">
        {checks.map((c) => (
          <li
            key={c.text}
            className={
              c.ok
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-muted-foreground"
            }
          >
            <span className="mr-1.5 inline-block align-middle">
              {c.ok ? (
                <Check className="size-3.5" />
              ) : (
                <X className="size-3.5" />
              )}
            </span>
            {c.text}
          </li>
        ))}
      </ul>
      {list.length > 0 && <ApplicationsSection list={list} onSaved={saved} />}
    </div>
  );
}
