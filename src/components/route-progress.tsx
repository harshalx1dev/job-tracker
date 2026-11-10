"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_START_EVENT, isAppPath } from "@/lib/nav-events";

/** Only show the bar for navigations that take longer than this (no flash on instant ones). */
const SHOW_AFTER_MS = 120;
/** Give up after this long (e.g. a navigation that was cancelled). */
const MAX_MS = 15_000;
const EASE = "cubic-bezier(.2,.8,.2,1)";

type Phase = "idle" | "loading" | "finishing";

/**
 * A slim accent bar across the top of the viewport while a page loads:
 * starts on click, eases towards 90% while waiting, completes when the new
 * route commits, then fades out. Purely visual (screen readers get Next.js's
 * own route announcer).
 *
 * It writes styles straight to the DOM instead of using React state: Next.js
 * starts navigations inside a transition, and state set from that moment would
 * be held back until the new page is ready, which is exactly when the bar is
 * no longer needed.
 */
export function RouteProgress() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const phase = useRef<Phase>("idle");
  const progress = useRef(0);
  const timers = useRef<{
    show?: number;
    trickle?: number;
    max?: number;
    hide?: number;
  }>({});

  const clear = useCallback(() => {
    const t = timers.current;
    window.clearTimeout(t.show);
    window.clearInterval(t.trickle);
    window.clearTimeout(t.max);
    window.clearTimeout(t.hide);
    timers.current = {};
  }, []);

  const setBar = useCallback((p: number, ms: number) => {
    progress.current = p;
    const bar = barRef.current;
    if (!bar) return;
    bar.style.transition = ms ? `transform ${ms}ms ${EASE}` : "none";
    bar.style.transform = `scaleX(${p})`;
  }, []);

  const setVisible = useCallback((on: boolean) => {
    if (wrapRef.current) wrapRef.current.style.opacity = on ? "1" : "0";
  }, []);

  const finish = useCallback(() => {
    if (phase.current !== "loading") return;
    clear();
    phase.current = "finishing";
    setBar(1, 200);
    // Let the bar reach the end, then fade it out and reset.
    timers.current.hide = window.setTimeout(() => {
      setVisible(false);
      timers.current.hide = window.setTimeout(() => {
        phase.current = "idle";
        setBar(0, 0);
      }, 220);
    }, 200);
  }, [clear, setBar, setVisible]);

  useEffect(() => {
    const start = () => {
      // Signed-out pages use the column wipe (PublicTransition) instead.
      if (!isAppPath(window.location.pathname)) return;
      clear();
      phase.current = "loading";
      setBar(0, 0);
      // Next frame, so the jump to 8% animates from zero.
      requestAnimationFrame(() => setBar(0.08, 400));
      timers.current.show = window.setTimeout(
        () => setVisible(true),
        SHOW_AFTER_MS,
      );
      // Trickle: fast at first, slowing as it approaches 90%.
      timers.current.trickle = window.setInterval(() => {
        const p = progress.current;
        setBar(Math.min(0.9, p + (0.9 - p) * 0.12), 400);
      }, 180);
      timers.current.max = window.setTimeout(finish, MAX_MS);
    };
    window.addEventListener(NAV_START_EVENT, start);
    return () => {
      window.removeEventListener(NAV_START_EVENT, start);
      clear();
    };
  }, [clear, finish, setBar, setVisible]);

  return (
    <>
      <Suspense>
        <RouteCommitWatcher onCommit={finish} />
      </Suspense>
      <div
        ref={wrapRef}
        aria-hidden
        data-route-progress
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]"
        style={{ opacity: 0, transition: `opacity 220ms ${EASE}` }}
      >
        <div
          ref={barRef}
          className="h-full origin-left bg-primary"
          style={{
            transform: "scaleX(0)",
            boxShadow: "0 0 10px var(--primary), 0 0 4px var(--primary)",
          }}
        />
      </div>
    </>
  );
}

/**
 * Calls onCommit whenever the URL (path or query) changes, i.e. a navigation has
 * rendered. It reads request data, so it sits inside Suspense on dynamic routes.
 */
export function RouteCommitWatcher({
  onCommit,
  pathOnly = false,
}: {
  onCommit: () => void;
  /** Ignore query-only changes (e.g. opening a job drawer via ?job=). */
  pathOnly?: boolean;
}) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const search = pathOnly ? "" : query;
  const first = useRef(true);
  // Layout effect: runs after the new route is in the DOM, before it's painted.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onCommit();
    // onCommit is stable or intentionally fresh; only the URL should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);
  return null;
}
