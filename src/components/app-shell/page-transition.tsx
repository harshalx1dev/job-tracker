"use client";

import { Suspense, useCallback, useRef } from "react";
import { RouteCommitWatcher } from "@/components/route-progress";

/**
 * Wraps the page content (not the shell). When a navigation commits, the new page fades and rises in
 * (220ms, the app's ease). It animates the existing element with the Web Animations
 * API in a layout effect, so the page never remounts and never flashes first.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const animate = useCallback(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    el.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }, []);

  return (
    <div ref={ref} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Suspense>
        <RouteCommitWatcher onCommit={animate} pathOnly />
      </Suspense>
      {children}
    </div>
  );
}
