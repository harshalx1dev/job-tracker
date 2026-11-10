"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ModelOption } from "@/lib/ai-models";
import { chooseDraftModel } from "@/server/ai/model-actions";
import type { ModelPicker } from "@/server/ai/models";

const DEFAULT = "default";

/**
 * Picks the model for every AI feature, from the models the user's
 * own key offers. Each pick is tested with one tiny call before it is saved;
 * models the key can't use are marked and disabled.
 */
export function DraftModelCard({ picker }: { picker: ModelPicker }) {
  if (picker.state === "no-key") {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Connect a Gemini key above to choose a model.
      </p>
    );
  }
  if (picker.state === "error") {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Couldn&rsquo;t load the models for your key right now, so AI features
        use{" "}
        <span className="font-mono text-foreground">{picker.defaultModel}</span>
        . Reload the page to try again.
      </p>
    );
  }
  return <Picker {...picker} />;
}

function Picker({
  defaultModel,
  selected,
  options,
  access,
}: Extract<ModelPicker, { state: "ready" }>) {
  const [value, setValue] = useState(selected ?? DEFAULT);
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // A saved model the key no longer lists still shows, so the choice is visible.
  const all: ModelOption[] =
    selected && !options.some((o) => o.id === selected)
      ? [...options, { id: selected, label: selected, preview: false }]
      : options;
  const labelOf = (id: string) => all.find((o) => o.id === id)?.label ?? id;
  const items = [
    { value: DEFAULT, label: `Default · ${defaultModel}` },
    ...all.map((o) => ({ value: o.id, label: o.label })),
  ];
  const usable = options.filter((o) => access[o.id] !== "blocked").length;

  function pick(next: string) {
    if (next === value) return;
    const previous = value;
    setValue(next);
    setError(null);
    setChecking(next === DEFAULT ? null : next);
    startTransition(async () => {
      const res = await chooseDraftModel(next === DEFAULT ? null : next);
      setChecking(null);
      if (!res.ok) {
        setValue(previous);
        setError(res.error);
        return;
      }
      toast.success(
        next === DEFAULT
          ? "AI features use the default model"
          : `AI features now use ${labelOf(next)}`,
      );
    });
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div>
        <label className="sr-only" htmlFor="draft-model">
          AI model
        </label>
        <p className="text-xs text-muted-foreground">
          Used for every AI feature: resume parsing, job import, match scores,
          outreach and answers. {options.length} models offered by your key
          {usable < options.length ? `, ${usable} usable` : ""}.
        </p>
      </div>
      <Select
        items={items}
        value={value}
        disabled={checking !== null}
        onValueChange={(v) => v && pick(String(v))}
      >
        <SelectTrigger id="draft-model" className="w-full sm:w-96">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>
            Default
            <span className="font-mono text-xs text-muted-foreground">
              {defaultModel}
            </span>
          </SelectItem>
          {all.map((o) => {
            const state = access[o.id];
            return (
              <SelectItem
                key={o.id}
                value={o.id}
                disabled={state === "blocked"}
              >
                {o.label}
                {state === "blocked" ? (
                  <span className="text-xs text-muted-foreground">
                    not available on your key
                  </span>
                ) : state === "ok" ? (
                  <CheckCircle2
                    aria-label="works with your key"
                    className="size-3.5 text-emerald-500"
                  />
                ) : o.preview ? (
                  <span className="text-xs text-muted-foreground">preview</span>
                ) : null}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {checking && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-3.5 animate-spin" />
          Checking {labelOf(checking)} with your key…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Each model is tested with one tiny request before it&rsquo;s used.
        Models your key can&rsquo;t use (for example Pro on a free key) are
        marked and can&rsquo;t be picked.
      </p>
    </div>
  );
}
