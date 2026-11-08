import { cn } from "@/lib/utils";

/** The mark: three board columns of different heights, the middle one in the accent. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("size-6 shrink-0", className)}
    >
      <rect
        x="2"
        y="3"
        width="5.5"
        height="14"
        rx="1.6"
        fill="currentColor"
        opacity="0.35"
      />
      <rect
        x="9.25"
        y="3"
        width="5.5"
        height="18"
        rx="1.6"
        fill="var(--primary)"
      />
      <rect
        x="16.5"
        y="3"
        width="5.5"
        height="10"
        rx="1.6"
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-medium tracking-[-0.03em]",
        className,
      )}
    >
      <LogoMark />
      Trackr
    </span>
  );
}
