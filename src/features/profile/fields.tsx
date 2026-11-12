"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Italic,
  Link as LinkIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyLink, toggleMarker, type Edit } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  className,
  plain,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  /** A div instead of a label: for editors with buttons inside, which a label would click. */
  plain?: boolean;
  children: React.ReactNode;
}) {
  const Tag = plain ? "div" : "label";
  return (
    <Tag className={cn("block space-y-1.5", className)}>
      <span className="block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      )}
    </Tag>
  );
}

export function TextInput(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} className={cn("h-9", props.className)} />;
}

/**
 * A textarea for short resume lines (education details) with a small toolbar
 * (bold, italic, link). The text stays plain **markup**. Ctrl/Cmd + B, I and K
 * do the same as the buttons. Summary, projects and experience use RichEditor.
 */
export function RichTextarea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const apply = (edit: (el: HTMLTextAreaElement) => Edit | null) => {
    const el = ref.current;
    const r = el && edit(el);
    if (!el || !r) return;
    onChange(r.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.start, r.end);
    });
  };
  const bold = () =>
    apply((el) =>
      toggleMarker(el.value, el.selectionStart, el.selectionEnd, "**"),
    );
  const italic = () =>
    apply((el) =>
      toggleMarker(el.value, el.selectionStart, el.selectionEnd, "*"),
    );
  const link = () =>
    apply((el) => {
      const url = window.prompt("Link address", "https://");
      if (!url) return null;
      const r = applyLink(el.value, el.selectionStart, el.selectionEnd, url);
      if (!r) window.alert("That doesn't look like a web address.");
      return r;
    });
  return (
    // The textarea comes first in the DOM, so the surrounding <label> targets it, not a button.
    <div className="flex flex-col-reverse gap-1.5">
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
          const run = { b: bold, i: italic, k: link }[e.key.toLowerCase()];
          if (!run) return;
          e.preventDefault();
          e.stopPropagation(); // Ctrl+K here is "link", not the app's global search
          run();
        }}
      />
      <div className="flex gap-0.5">
        <ToolButton label="Bold (Ctrl+B)" onClick={bold}>
          <Bold />
        </ToolButton>
        <ToolButton label="Italic (Ctrl+I)" onClick={italic}>
          <Italic />
        </ToolButton>
        <ToolButton label="Link (Ctrl+K)" onClick={link}>
          <LinkIcon />
        </ToolButton>
      </div>
    </div>
  );
}

export function ToolButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(active && "bg-accent text-accent-foreground")}
      // Keep the text selection: a click on the button must not move focus away.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
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
    <RichTextarea
      rows={rows}
      value={raw}
      placeholder={placeholder}
      onChange={(text) => {
        setRaw(text);
        onChange(
          text
            .split("\n")
            // Drop a leading bullet symbol, but never the * of **bold** or *italic*.
            .map((l) => l.replace(/^\s*(?:[-•]\s*|\*\s+)/, "").trim())
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
