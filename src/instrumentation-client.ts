/**
 * Runs in the browser before the app is interactive. Next.js calls
 * onRouterTransitionStart when an App Router navigation begins; we turn it into a
 * window event that the top progress bar listens for (src/components/route-progress.tsx).
 */
import { NAV_START_EVENT } from "@/lib/nav-events";

export function onRouterTransitionStart(url: string) {
  try {
    const next = new URL(url, window.location.href);
    // Hash jumps and same-URL navigations don't load anything: no bar.
    if (
      next.pathname === window.location.pathname &&
      next.search === window.location.search
    )
      return;
    window.dispatchEvent(
      new CustomEvent(NAV_START_EVENT, { detail: next.pathname + next.search }),
    );
  } catch {
    // Never let instrumentation break navigation.
  }
}
