"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "motion/react";
import { Check, Moon, Palette, RotateCcw, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Trial-only: lets you compare accents and bases live. Remove once one is chosen. */
export const ACCENTS = [
  { id: "bronze", label: "Bronze", swatch: "#a08672" },
  { id: "ocean", label: "Ocean", swatch: "#3b7bf5" },
  { id: "emerald", label: "Emerald", swatch: "#22b07d" },
  { id: "coral", label: "Coral", swatch: "#f2664a" },
  { id: "amber", label: "Amber", swatch: "#eaab30" },
  { id: "lime", label: "Lime", swatch: "#8abd36" },
  { id: "mono", label: "Mono", swatch: "#d4d4d4" },
] as const;

export const BASES = [
  { id: "neutral", label: "Neutral", swatch: "#1c1c1c" },
  { id: "warm", label: "Warm", swatch: "#1f1b18" },
  { id: "cool", label: "Cool", swatch: "#18202a" },
] as const;

export const THEME_LAB_KEY = "trackr:theme-lab";

/** Inline script for <head>: applies the saved choice before first paint (no flash). */
export const themeLabBootScript = `try{var t=JSON.parse(localStorage.getItem("${THEME_LAB_KEY}")||"{}"),d=document.documentElement;if(t.accent&&t.accent!=="bronze")d.dataset.accent=t.accent;if(t.base&&t.base!=="neutral")d.dataset.base=t.base}catch(e){}`;

type Choice = { accent: string; base: string };

function read(): Choice {
  const d = document.documentElement.dataset;
  return { accent: d.accent ?? "bronze", base: d.base ?? "neutral" };
}

function apply(next: Choice) {
  const d = document.documentElement;
  if (next.accent === "bronze") delete d.dataset.accent;
  else d.dataset.accent = next.accent;
  if (next.base === "neutral") delete d.dataset.base;
  else d.dataset.base = next.base;
  try {
    localStorage.setItem(THEME_LAB_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode): the choice still applies for this visit.
  }
}

const emptySubscribe = () => () => {};

export function ThemeLab() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice>({
    accent: "bronze",
    base: "neutral",
  });
  const { resolvedTheme, setTheme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (!mounted) return null;

  const update = (patch: Partial<Choice>) => {
    const next = { ...read(), ...patch };
    apply(next);
    setChoice(next);
  };

  return (
    <div ref={panelRef} className="fixed right-4 bottom-4 z-50 print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ transformOrigin: "bottom right" }}
            className="absolute right-0 bottom-14 w-[19rem] rounded-2xl border bg-popover p-4 text-popover-foreground shadow-2xl"
            role="dialog"
            aria-label="Theme lab"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Theme lab</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => update({ accent: "bronze", base: "neutral" })}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                  aria-label="Reset to default"
                  title="Reset"
                >
                  <RotateCcw className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                  aria-label="Close theme lab"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            <p className="mb-2 text-xs text-muted-foreground">Accent</p>
            <div className="grid grid-cols-4 gap-1.5">
              {ACCENTS.map((a) => {
                const on = (choice.accent ?? "bronze") === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ accent: a.id })}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border border-transparent py-2 text-[11px] transition-colors hover:bg-surface",
                      on && "border-border bg-surface",
                    )}
                  >
                    <span
                      className="grid size-6 place-items-center rounded-full"
                      style={{ background: a.swatch }}
                    >
                      {on && <Check className="size-3.5 text-black/70" />}
                    </span>
                    {a.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 mb-2 text-xs text-muted-foreground">
              Background
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {BASES.map((b) => {
                const on = (choice.base ?? "neutral") === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ base: b.id })}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors hover:bg-surface",
                      on ? "border-foreground/30 bg-surface" : "border-border",
                    )}
                  >
                    <span
                      className="size-3.5 rounded-sm border"
                      style={{ background: b.swatch }}
                    />
                    {b.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 mb-2 text-xs text-muted-foreground">Mode</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(["light", "dark"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={resolvedTheme === m}
                  onClick={() => setTheme(m)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-2 py-1.5 text-xs capitalize transition-colors hover:bg-surface",
                    resolvedTheme === m
                      ? "border-foreground/30 bg-surface"
                      : "border-border",
                  )}
                >
                  {m === "light" ? (
                    <Sun className="size-3.5" />
                  ) : (
                    <Moon className="size-3.5" />
                  )}
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Saved in this browser only. Tell Claude which one you like to make
              it the default.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => {
          setChoice(read());
          setOpen((o) => !o);
        }}
        aria-label={open ? "Close theme lab" : "Open theme lab"}
        aria-expanded={open}
        className="grid size-11 place-items-center rounded-full border bg-popover text-foreground shadow-lg transition-[translate,background-color] duration-150 hover:-translate-y-px hover:bg-surface active:translate-y-px"
      >
        <Palette className="size-4.5" />
      </button>
    </div>
  );
}
