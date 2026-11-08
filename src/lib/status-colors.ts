/**
 * Status colour tokens: the only colour in the board besides the accent.
 * Literal class strings so Tailwind can see them. No violet/lavender hues (design rule).
 */
export const STATUS_COLORS = {
  slate: {
    dot: "bg-neutral-400",
    text: "text-neutral-500 dark:text-neutral-400",
  },
  sky: { dot: "bg-sky-500", text: "text-sky-700 dark:text-sky-400" },
  teal: { dot: "bg-teal-500", text: "text-teal-700 dark:text-teal-400" },
  amber: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  emerald: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  rose: { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400" },
  zinc: { dot: "bg-neutral-600", text: "text-neutral-500" },
  blue: { dot: "bg-blue-500", text: "text-blue-700 dark:text-blue-400" },
} as const;

export type StatusColor = keyof typeof STATUS_COLORS;

/** Legacy keys from before the palette change. */
const ALIASES: Record<string, StatusColor> = { violet: "teal", indigo: "blue" };

export function statusColor(color: string) {
  const key = (ALIASES[color] ?? color) as StatusColor;
  return STATUS_COLORS[key in STATUS_COLORS ? key : "slate"];
}

export const DEFAULT_STATUSES: {
  name: string;
  color: StatusColor;
  kind: "open" | "won" | "lost";
}[] = [
  { name: "Wishlist", color: "slate", kind: "open" },
  { name: "Applied", color: "sky", kind: "open" },
  { name: "Assessment", color: "teal", kind: "open" },
  { name: "Interviewing", color: "amber", kind: "open" },
  { name: "Offer", color: "emerald", kind: "won" },
  { name: "Rejected", color: "rose", kind: "lost" },
  { name: "Ghosted", color: "zinc", kind: "lost" },
];
