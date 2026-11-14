"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
                  set(
                    "workModes",
                    on
                      ? p.workModes.filter((x) => x !== m)
                      : [...p.workModes, m],
                  )
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
