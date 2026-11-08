"use client";

import { useEffect, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";

type Card = { co: string; title: string; tags?: string[] };

const NORTHWIND: Card = {
  co: "Northwind",
  title: "Senior Frontend Engineer",
  tags: ["React", "Next.js"],
};

const BASE: { name: string; dot: string; cards: Card[] }[] = [
  {
    name: "Wishlist",
    dot: "#8f8f8f",
    cards: [
      {
        co: "Halcyon",
        title: "Frontend Engineer, Design Systems",
        tags: ["React"],
      },
      { co: "Brightwell", title: "Senior UI Engineer" },
    ],
  },
  {
    name: "Applied",
    dot: "#0ea5e9",
    cards: [
      NORTHWIND,
      { co: "Lumen Labs", title: "React Developer", tags: ["TypeScript"] },
    ],
  },
  {
    name: "Interviewing",
    dot: "#f59e0b",
    cards: [
      {
        co: "Acme Cloud",
        title: "UI Platform Engineer",
        tags: ["Vue", "Vite"],
      },
    ],
  },
  {
    name: "Offer",
    dot: "#10b981",
    cards: [{ co: "Orbitly", title: "Staff Frontend Engineer" }],
  },
];

/** The board after the cycle's one change: Northwind moves to the top of Interviewing. */
function columnsFor(moved: boolean) {
  if (!moved) return BASE;
  return BASE.map((c) =>
    c.name === "Applied"
      ? { ...c, cards: c.cards.filter((x) => x !== NORTHWIND) }
      : c.name === "Interviewing"
        ? { ...c, cards: [NORTHWIND, ...c.cards] }
        : c,
  );
}

const CYCLE_MS = 3200;

/**
 * The product window in the hero, as live HTML. One subject per 3.2 s cycle: a card
 * really changes column (a layout animation, so nothing overlaps), holds, then the
 * board dims and rewrites for the next cycle. Pausable; still under reduced motion.
 */
export function HeroBoard() {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [moved, setMoved] = useState(false);
  const [dim, setDim] = useState(false);

  useEffect(() => {
    if (paused || reduced) return;
    const t1 = setTimeout(() => setMoved(true), 700);
    const t2 = setTimeout(() => setDim(true), CYCLE_MS - 300);
    const t3 = setTimeout(() => {
      setMoved(false);
      setDim(false);
      setCycle((c) => c + 1);
    }, CYCLE_MS);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [cycle, paused, reduced]);

  const columns = columnsFor(reduced ? true : moved);

  return (
    <>
      <div className="lp-app" data-ui aria-label="Job board preview" role="img">
        <div className="lp-app__bar">
          <i />
          <i />
          <i />
          <span>Jobs · 6 active</span>
        </div>
        {/* Re-keyed each cycle so the reset rewrites in place instead of animating back. */}
        <LayoutGroup key={cycle}>
          <motion.div
            className="lp-cols"
            animate={{ opacity: dim ? 0.55 : 1 }}
            transition={{ duration: 0.2 }}
          >
            {columns.map((col) => (
              <div className="lp-col" key={col.name}>
                <div className="lp-col__h">
                  <span className="lp-dot" style={{ background: col.dot }} />
                  {col.name}
                  <em>{col.cards.length}</em>
                </div>
                {col.cards.map((card) => (
                  <motion.div
                    layout="position"
                    layoutId={card.co}
                    key={card.co}
                    className="lp-card"
                    transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
                  >
                    <div className="lp-card__co">
                      <span className="lp-card__mark">{card.co[0]}</span>
                      {card.co}
                    </div>
                    <div className="lp-card__t">{card.title}</div>
                    {card.tags && (
                      <div className="lp-card__tags">
                        {card.tags.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ))}
          </motion.div>
        </LayoutGroup>
      </div>
      <button
        type="button"
        className="lp-pause"
        aria-label={paused ? "Play animation" : "Pause animation"}
        onClick={() => setPaused((p) => !p)}
      >
        {paused ? (
          <Play className="size-3.5" />
        ) : (
          <Pause className="size-3.5" />
        )}
      </button>
    </>
  );
}
