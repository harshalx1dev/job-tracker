"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { statusColor } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import type { Status } from "./utils";

export function StatusSelect({
  statuses,
  value,
  onChange,
  size = "default",
  variant = "outline",
  className,
  id,
}: {
  statuses: Status[];
  value: string;
  onChange: (statusId: string) => void;
  size?: "sm" | "default";
  /** "ghost" blends into table rows until hovered. */
  variant?: "outline" | "ghost";
  className?: string;
  id?: string;
}) {
  const items = statuses.map((s) => ({ value: s.id, label: s.name }));
  const current = statuses.find((s) => s.id === value);
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => v && onChange(String(v))}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={cn(
          "min-w-32 gap-2",
          variant === "ghost" &&
            "border-transparent bg-transparent shadow-none hover:border-border hover:bg-surface dark:bg-transparent",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {current && (
          <span
            aria-hidden
            className={cn(
              "size-2 shrink-0 rounded-full",
              statusColor(current.color).dot,
            )}
          />
        )}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span
              className={cn("size-2 rounded-full", statusColor(s.color).dot)}
            />
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
