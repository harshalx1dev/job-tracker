"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/profile";
import { normalizeDesign, pageSize, type ResumeDesign } from "@/lib/resume";
import { ResumeDocument } from "./resume-document";
import "./resume.css";

const MM = 96 / 25.4;
const GAP = 16; // px between page cards (screen px, after scaling)

type Unit = { top: number; bottom: number; keep: boolean };

/** Greedy page breaks: returns the content offset (px) where each page starts. */
function computeBreaks(units: Unit[], contentH: number): number[] {
  const sorted = [...units].sort((a, b) => a.top - b.top);
  // Glue each keep-next unit to the one after it.
  const groups: { top: number; bottom: number }[] = [];
  let cur: { top: number; bottom: number } | null = null;
  for (const u of sorted) {
    if (cur) {
      cur.bottom = Math.max(cur.bottom, u.bottom);
    } else cur = { top: u.top, bottom: u.bottom };
    if (!u.keep) {
      groups.push(cur);
      cur = null;
    }
  }
  if (cur) groups.push(cur);

  const starts = [0];
  let start = 0;
  for (const g of groups) {
    if (g.bottom - start > contentH + 0.5 && g.top > start) {
      start = g.top;
      starts.push(start);
    }
  }
  return starts;
}

/** Renders the resume as separate pages (like the PDF), scaled to the container's width. */
export function ScaledPage({
  content,
  design: rawDesign,
  className,
  shadow = true,
}: {
  content: Profile;
  design: ResumeDesign;
  className?: string;
  shadow?: boolean;
}) {
  const design = normalizeDesign(rawDesign);
  const { w: PAGE_W, h: PAGE_H } = pageSize(design);
  const dKey = JSON.stringify(design);
  const marginPx = design.margin * MM;
  const contentH = PAGE_H - 2 * marginPx;

  const box = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [starts, setStarts] = useState<number[]>([0]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / PAGE_W),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [PAGE_W]);

  const recompute = useCallback(() => {
    const root = measure.current;
    if (!root) return;
    const base = root.getBoundingClientRect().top;
    const units: Unit[] = Array.from(
      root.querySelectorAll<HTMLElement>("[data-unit]"),
    ).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: r.top - base,
        bottom: r.bottom - base,
        keep: el.dataset.keep === "next",
      };
    });
    const next = computeBreaks(units, contentH);
    setStarts((prev) =>
      prev.length === next.length && prev.every((v, i) => v === next[i])
        ? prev
        : next,
    );
  }, [contentH]);

  useEffect(() => {
    const el = measure.current;
    if (!el) return;
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    let live = true;
    document.fonts?.ready.then(() => live && recompute());
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [recompute, content, dKey]);

  const pageHScaled = PAGE_H * scale;
  const n = starts.length;

  return (
    <div ref={box} className={className}>
      {/* Hidden layer: the document laid out once, only used for measuring. */}
      <div
        ref={measure}
        aria-hidden="true"
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          width: PAGE_W,
          left: -99999,
          top: 0,
        }}
      >
        <ResumeDocument content={content} design={design} />
      </div>

      {scale > 0 &&
        starts.map((start, i) => (
          <div key={i} style={{ marginTop: i ? GAP : 0 }}>
            <div
              style={{
                width: PAGE_W * scale,
                height: pageHScaled,
                overflow: "hidden",
                background: "#fff",
                borderRadius: 2,
                boxShadow: shadow
                  ? "0 1px 2px rgb(0 0 0 / 0.08), 0 20px 50px -20px rgb(0 0 0 / 0.35)"
                  : undefined,
              }}
              aria-label={`Resume page ${i + 1} of ${n}`}
            >
              <div
                style={{
                  width: PAGE_W,
                  height: PAGE_H,
                  paddingTop: marginPx,
                  paddingBottom: marginPx,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    // Stop at the next page's first unit, so its top lines don't show here too.
                    height: Math.min(
                      contentH,
                      (starts[i + 1] ?? Infinity) - start,
                    ),
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div style={{ transform: `translateY(${-start}px)` }}>
                    <ResumeDocument content={content} design={design} />
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Page {i + 1} of {n}
            </p>
          </div>
        ))}
      {scale === 0 && <div style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }} />}
    </div>
  );
}
