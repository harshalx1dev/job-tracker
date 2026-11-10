"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import { RouteCommitWatcher } from "@/components/route-progress";
import { NAV_START_EVENT, introState, isAppPath } from "@/lib/nav-events";

const EASE = "cubic-bezier(.7,0,.2,1)";
const COVER_MS = 460;
const STAGGER_MS = 70;
/** Reveal anyway if the new page never commits (a cancelled navigation). */
const MAX_MS = 10_000;

type Phase = "idle" | "covering" | "revealing";

/**
 * The page change on signed-out pages (landing, sign-in, shared prep): three
 * panels shaped like the logo's columns sweep up over the page, the mark's bars
 * pulse while the next page loads, then the panels sweep off the top.
 *
 * Driven with the Web Animations API, not React state: navigations run inside
 * a React transition that would hold state updates back until the new page is
 * ready. Signed-in pages use the top bar (RouteProgress) instead.
 */
export function PublicTransition() {
  const rootRef = useRef<HTMLDivElement>(null);
  const phase = useRef<Phase>("idle");
  const covered = useRef<Promise<unknown>>(Promise.resolve());
  const maxTimer = useRef<number>(undefined);

  const parts = () => {
    const root = rootRef.current!;
    return {
      root,
      panels: [...root.querySelectorAll<HTMLElement>("[data-panel]")],
      loader: root.querySelector<HTMLElement>("[data-loader]")!,
    };
  };

  const reveal = useCallback(async () => {
    if (phase.current !== "covering") return;
    phase.current = "revealing";
    window.clearTimeout(maxTimer.current);
    await covered.current;
    const { root, panels, loader } = parts();
    loader.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 160,
      fill: "forwards",
    });
    const out = panels.map((p, i) =>
      p.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
        {
          duration: COVER_MS,
          delay: 80 + i * STAGGER_MS,
          easing: EASE,
          fill: "forwards",
        },
      ),
    );
    await Promise.all(out.map((a) => a.finished)).catch(() => {});
    if (phase.current !== "revealing") return; // a new navigation took over
    root.style.visibility = "hidden";
    phase.current = "idle";
  }, []);

  useEffect(() => {
    const start = () => {
      if (isAppPath(window.location.pathname)) return;
      introState.played = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const { root, panels, loader } = parts();
      root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      root.style.visibility = "visible";
      phase.current = "covering";
      const cover = panels.map((p, i) =>
        p.animate(
          [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
          {
            duration: COVER_MS,
            delay: i * STAGGER_MS,
            easing: EASE,
            fill: "forwards",
          },
        ),
      );
      loader.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 200,
        delay: COVER_MS,
        fill: "forwards",
      });
      covered.current = Promise.all(cover.map((a) => a.finished)).catch(
        () => {},
      );
      window.clearTimeout(maxTimer.current);
      maxTimer.current = window.setTimeout(reveal, MAX_MS);
    };
    window.addEventListener(NAV_START_EVENT, start);
    return () => {
      window.removeEventListener(NAV_START_EVENT, start);
      window.clearTimeout(maxTimer.current);
    };
  }, [reveal]);

  return (
    <>
      <Suspense>
        <RouteCommitWatcher onCommit={reveal} />
      </Suspense>
      <div
        ref={rootRef}
        aria-hidden
        data-public-transition
        className="pointer-events-none fixed inset-0 z-[70] grid grid-cols-3 overflow-hidden"
        style={{ visibility: "hidden" }}
      >
        <div data-panel className="wipe-panel" />
        <div data-panel className="wipe-panel wipe-panel--accent" />
        <div data-panel className="wipe-panel" />
        <div
          data-loader
          className="absolute inset-0 grid place-items-center opacity-0"
        >
          <span className="eq-bars">
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </>
  );
}
