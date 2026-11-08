"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/profile";
import type { ResumeDesign } from "@/lib/resume";
import { ResumeDocument } from "./resume-document";
import "./resume.css";

const PAGE_W = 794; // 210mm at 96dpi
const PAGE_H = 1123; // 297mm at 96dpi

/** Renders the real A4 resume, scaled down to the container's width. */
export function ScaledPage({
  content,
  design,
  className,
  shadow = true,
}: {
  content: Profile;
  design: ResumeDesign;
  className?: string;
  shadow?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [height, setHeight] = useState(PAGE_H);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / PAGE_W),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Long resumes run past one page: grow the box with the content.
  useEffect(() => {
    const el = page.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setHeight(Math.max(PAGE_H, el.scrollHeight)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={box}
      className={className}
      style={{
        height: scale ? height * scale : undefined,
        aspectRatio: scale ? undefined : `${PAGE_W} / ${PAGE_H}`,
      }}
    >
      <div
        ref={page}
        style={{
          width: PAGE_W,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          opacity: scale ? 1 : 0,
          boxShadow: shadow
            ? "0 1px 2px rgb(0 0 0 / 0.08), 0 20px 50px -20px rgb(0 0 0 / 0.35)"
            : undefined,
        }}
        className="overflow-hidden rounded-[2px]"
        aria-label="Resume preview"
      >
        <ResumeDocument content={content} design={design} />
      </div>
    </div>
  );
}
