"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SCORE_BANDS,
  SCORE_DEALBREAKERS,
  SCORE_FACTORS,
} from "@/lib/match-scoring";
import { WORK_MODES, type Preferences } from "@/lib/preferences";
import { savePreferences } from "@/server/profile/preferences-actions";
import { cn } from "@/lib/utils";

const MODE_LABEL = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [p, setP] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) =>
    setP((cur) => ({ ...cur, [k]: v }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await savePreferences(p);
      if (!res.ok) return void setError(res.error);
      toast.success("Preferences saved");
    });
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Field
        label="Target roles"
        hint="One per line, for example Frontend Developer (React), AEM Developer."
      >
        <Textarea
          value={p.roles}
          onChange={(e) => set("roles", e.target.value)}
          rows={3}
        />
      </Field>
      <Field label="Locations" hint="Cities or regions you'd work in.">
        <Textarea
          value={p.locations}
          onChange={(e) => set("locations", e.target.value)}
          rows={2}
        />
      </Field>
      <Field label="Work mode" hint="Pick every mode you'd accept.">
        <div className="flex flex-wrap gap-2">
          {WORK_MODES.map((m) => {
            const on = p.workModes.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setP((cur) => ({
                    ...cur,
                    workModes: cur.workModes.includes(m)
                      ? cur.workModes.filter((x) => x !== m)
                      : [...cur.workModes, m],
                  }))
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  on
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {MODE_LABEL[m]}
              </button>
            );
          })}
        </div>
      </Field>
      <Field
        label="Pay"
        hint="Your floor and what you're aiming for, for example INR 6 to 8 LPA, not below 6."
      >
        <Input
          value={p.salary}
          onChange={(e) => set("salary", e.target.value)}
        />
      </Field>
      <Field
        label="Skip these"
        hint="Companies, industries or kinds of roles to leave out."
      >
        <Textarea
          value={p.avoid}
          onChange={(e) => set("avoid", e.target.value)}
          rows={2}
        />
      </Field>
      <Field
        label="Jobs per session"
        hint="The most jobs Claude should handle in one run. A modest number keeps applications careful."
      >
        <Input
          type="number"
          min={1}
          max={50}
          value={p.maxPerSession}
          onChange={(e) =>
            set(
              "maxPerSession",
              Math.max(1, Math.min(50, Number(e.target.value) || 1)),
            )
          }
          className="w-24"
        />
      </Field>
      <Field
        label="Minimum fit score"
        hint="Claude prepares an application only for jobs it scores at or above this, out of 100."
      >
        <Input
          type="number"
          min={0}
          max={100}
          value={p.minScore}
          onChange={(e) =>
            set(
              "minScore",
              Math.max(
                0,
                Math.min(100, Math.round(Number(e.target.value) || 0)),
              ),
            )
          }
          className="w-24"
        />
        <ScoreGuide />
      </Field>
      <Field
        label="Anything else"
        hint="Team size, tech you want or want to avoid, deal-breakers."
      >
        <Textarea
          value={p.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={4}
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Save preferences
      </Button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

/** How Claude scores a job: the same text Claude's playbook uses. */
function ScoreGuide() {
  return (
    <details className="mt-2 rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        How Claude scores a job
      </summary>
      <div className="mt-3 space-y-3 text-xs">
        <p className="text-muted-foreground">
          Claude scores how well your profile fits a job, from 0 to 100, using
          only what is in your profile. The score comes from four parts:
        </p>
        <ul className="space-y-1">
          {SCORE_FACTORS.map((f) => (
            <li key={f.name}>
              <span className="font-medium">
                {f.name} ({f.points})
              </span>
              <span className="text-muted-foreground"> {f.detail}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">{SCORE_DEALBREAKERS}</p>
        <table className="w-full text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-2 font-normal">Score</th>
              <th className="py-1 pr-2 font-normal">Means</th>
              <th className="py-1 font-normal">What happens</th>
            </tr>
          </thead>
          <tbody>
            {SCORE_BANDS.map((b) => (
              <tr key={b.range} className="border-t align-top">
                <td className="py-1.5 pr-2 whitespace-nowrap">{b.range}</td>
                <td className="py-1.5 pr-2">
                  <span className="font-medium">{b.meaning}.</span> {b.why}
                </td>
                <td className="py-1.5 text-muted-foreground">{b.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-muted-foreground">
          The minimum score above moves the &ldquo;prepared&rdquo; line: set it
          to 60 and Claude also prepares jobs in the 60s.
        </p>
      </div>
    </details>
  );
}
