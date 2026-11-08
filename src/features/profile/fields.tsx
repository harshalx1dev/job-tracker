"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

export function TextInput(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} className={cn("h-9", props.className)} />;
}

/** One entry per line (resume bullets). Keeps the raw text while typing. */
export function LinesInput({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(value.join("\n"));
  return (
    <Textarea
      rows={rows}
      value={raw}
      placeholder={placeholder}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(
          e.target.value
            .split("\n")
            .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
            .filter(Boolean),
        );
      }}
    />
  );
}

/** Comma-separated values (tech, skills). Keeps the raw text while typing. */
export function CommaInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(value.join(", "));
  return (
    <TextInput
      value={raw}
      placeholder={placeholder}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(
          e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}

/** A list of repeatable entries with add, remove and move up/down. */
export function ListEditor<T>({
  items,
  onChange,
  make,
  title,
  addLabel,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  make: () => T;
  title: (item: T, i: number) => string;
  addLabel: string;
  render: (
    item: T,
    set: (patch: Partial<T>) => void,
    i: number,
  ) => React.ReactNode;
}) {
  // Bumped on move/remove so each entry's inputs re-read their (moved) values.
  const [epoch, setEpoch] = useState(0);
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setEpoch((e) => e + 1);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        // Entries have no ids; the epoch re-keys them after a move or removal.
        <div key={`${epoch}:${i}`} className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {title(item, i) || "Untitled"}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Move up"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Move down"
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Remove"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                setEpoch((e) => e + 1);
                onChange(items.filter((_, j) => j !== i));
              }}
            >
              <Trash2 />
            </Button>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {render(
              item,
              (patch) =>
                onChange(
                  items.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                ),
              i,
            )}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, make()])}
      >
        <Plus /> {addLabel}
      </Button>
    </div>
  );
}
