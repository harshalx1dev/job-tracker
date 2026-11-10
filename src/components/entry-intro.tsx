"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";
import { introState } from "@/lib/nav-events";

/**
 * The first-load intro on signed-out pages: the logo's columns grow in one by
 * one, the name rises, then the screen lifts like a curtain onto the page.
 * Pure CSS (globals.css, .intro), so it plays before JavaScript loads and the
 * page is never stuck behind it; skipped under reduced motion, and not replayed
 * on in-app navigations (those get the column wipe).
 */
export function EntryIntro() {
  // True only on the first render after a real page load.
  const [show, setShow] = useState(() => !introState.played);
  useEffect(() => {
    introState.played = true;
  }, []);
  if (!show) return null;
  return (
    <div
      aria-hidden
      data-entry-intro
      className="intro"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setShow(false);
      }}
    >
      <div className="intro__glow" />
      <div className="intro__brand">
        <LogoMark className="intro__mark size-14" />
        <span className="intro__name">
          <span>Trackr</span>
        </span>
      </div>
    </div>
  );
}
