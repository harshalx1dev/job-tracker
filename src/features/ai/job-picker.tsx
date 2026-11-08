"use client";

import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type JobOption = { id: string; company: string; title: string };

/** Optional job context for AI writing ("none" = general). */
export function JobPicker({
  jobs,
  value,
  onChange,
  id,
}: {
  jobs: JobOption[];
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const items = [
    { value: "none", label: "No specific job" },
    ...jobs.map((j) => ({ value: j.id, label: `${j.company} · ${j.title}` })),
  ];
  return (
    <Select
      items={items}
      value={value || "none"}
      onValueChange={(v) => onChange(!v || v === "none" ? "" : String(v))}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function KeyHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
      AI drafting needs a Gemini key.{" "}
      <Link
        href="/app/settings"
        className="text-foreground underline underline-offset-4"
      >
        Connect one in Settings
      </Link>
      .
    </p>
  );
}
