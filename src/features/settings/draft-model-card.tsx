"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ModelOption, ModelTier } from "@/lib/ai-models";
import { chooseDraftModel, refreshModels } from "@/server/ai/model-actions";
import type { ModelPicker } from "@/server/ai/models";

const DEFAULT = "default";

const TIERS: { tier: ModelTier; title: string; blurb: string }[] = [
  {
    tier: "basic",
    title: "Quick tasks model",
    blurb:
      "Reads a resume or a job posting and pulls out the fields. A light, fast model is enough, and free keys get far more requests a day with it.",
  },
  {
    tier: "smart",
    title: "Writing and judgement model",
    blurb:
      "Match scores, outreach, answers and profile questions. Use the best model your key allows.",
  },
];

/**
 * Picks the model for each kind of AI task from the models the user's own key
 * offers. Each pick is tested with one tiny call before it is saved; models the
 * key can't use are marked and disabled.
 */
export function DraftModelCard({ picker }: { picker: ModelPicker }) {
  if (picker.state === "no-key") {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Connect a Gemini key above to choose models.
      </p>
    );
  }
  if (picker.state === "error") {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Couldn&rsquo;t load the models for your key right now, so AI features
        use their default models. Reload the page to try again.
      </p>
    );
  }
  return <Ready {...picker} />;
}

function Ready({
  tiers,
  options,
  access,
}: Extract<ModelPicker, { state: "ready" }>) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const usable = options.filter((o) => access[o.id] !== "blocked").length;

  function refresh() {
    setError(null);
    setRefreshing(true);
    startTransition(async () => {
      const res = await refreshModels();
      setRefreshing(false);
      if (!res.ok) return void setError(res.error);
      toast.success(`${res.data.count} models offered by your key`);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={refresh}
        >
          {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Refresh models
        </Button>
        <span className="text-xs text-muted-foreground">
          {options.length} models offered by your key
          {usable < options.length ? `, ${usable} usable` : ""}. Refresh reloads
          the list and re-tests models marked unavailable.
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {TIERS.map((t) => (
        <TierPicker
          key={t.tier}
          {...t}
          {...tiers[t.tier]}
          options={options}
          access={access}
        />
      ))}
      <p className="text-xs text-muted-foreground">
        Each model is tested with one tiny request before it&rsquo;s used.
        Models your key can&rsquo;t use (for example Pro on a free key) are
        marked and can&rsquo;t be picked.
      </p>
    </div>
  );
}

function TierPicker({
  tier,
  title,
  blurb,
  defaultModel,
  selected,
  options,
  access,
}: (typeof TIERS)[number] & {
  defaultModel: string;
  selected: string | null;
  options: ModelOption[];
  access: Record<string, "ok" | "blocked">;
}) {
  const [value, setValue] = useState(selected ?? DEFAULT);
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
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

  function pick(next: string, isCustom = false) {
    if (next === value) return;
    const previous = value;
    setValue(next);
    setError(null);
    setChecking(next === DEFAULT ? null : next);
    startTransition(async () => {
      const res = await chooseDraftModel(
        next === DEFAULT ? null : next,
        isCustom,
        tier,
      );
      setChecking(null);
      if (!res.ok) {
        setValue(previous);
        setError(res.error);
        return;
      }
      if (isCustom) setCustom("");
      toast.success(
        next === DEFAULT
          ? `${title} uses the default model`
          : `${title} now uses ${labelOf(next)}`,
      );
    });
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <div>
        <label className="text-sm font-medium" htmlFor={`model-${tier}`}>
          {title}
        </label>
        <p className="text-xs text-muted-foreground">{blurb}</p>
      </div>
      <Select
        items={items}
        value={value}
        disabled={checking !== null}
        onValueChange={(v) => v && pick(String(v))}
      >
        <SelectTrigger id={`model-${tier}`} className="w-full sm:w-96">
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
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Model not listed? Enter its id
        </summary>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = custom.trim();
            if (id) pick(id, true);
          }}
        >
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="gemini-…"
            className="w-full font-mono sm:w-72"
            aria-label={`${title}: model id`}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!custom.trim() || checking !== null}
          >
            Test and use
          </Button>
        </form>
      </details>
    </div>
  );
}
