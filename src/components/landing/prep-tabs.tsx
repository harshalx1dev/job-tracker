"use client";

import { useState } from "react";
import { motion } from "motion/react";

type Q = { p: string; q: string; topic: string; min: number };

const PLANS: {
  id: string;
  label: string;
  total: string;
  scope: string;
  rows: Q[];
}[] = [
  {
    id: "crash",
    label: "1 day",
    total: "18 questions · 5 h 40 min",
    scope: "P1 and most asked only",
    rows: [
      {
        p: "P1",
        q: "How does React decide when to re-render?",
        topic: "React rendering",
        min: 20,
      },
      {
        p: "P1",
        q: "Explain the event loop with a microtask example",
        topic: "JavaScript",
        min: 25,
      },
      {
        p: "P1",
        q: "Server and client components: where does each run?",
        topic: "Next.js",
        min: 20,
      },
      {
        p: "P1",
        q: "Design a typeahead search that stays fast",
        topic: "Frontend system design",
        min: 45,
      },
      {
        p: "P1",
        q: "Generics with constraints, with a real use",
        topic: "TypeScript",
        min: 15,
      },
      {
        p: "P1",
        q: "What causes layout shift and how do you measure it?",
        topic: "Performance",
        min: 15,
      },
      {
        p: "P1",
        q: "Keys in lists: what breaks when they are wrong?",
        topic: "React rendering",
        min: 10,
      },
      {
        p: "P1",
        q: "Debounce versus throttle, with code",
        topic: "JavaScript",
        min: 15,
      },
    ],
  },
  {
    id: "multi",
    label: "3 days",
    total: "41 questions · 3 days",
    scope: "P1 on day 1, P2 on day 2, review on day 3",
    rows: [
      {
        p: "P1",
        q: "How does React decide when to re-render?",
        topic: "Day 1 · React rendering",
        min: 20,
      },
      {
        p: "P1",
        q: "Explain the event loop with a microtask example",
        topic: "Day 1 · JavaScript",
        min: 25,
      },
      {
        p: "P2",
        q: "When would you reach for useLayoutEffect?",
        topic: "Day 2 · React hooks",
        min: 15,
      },
      {
        p: "P2",
        q: "Cache invalidation after a mutation",
        topic: "Day 2 · Next.js",
        min: 20,
      },
      {
        p: "P2",
        q: "Accessible drag and drop: keyboard and screen readers",
        topic: "Day 2 · Accessibility",
        min: 25,
      },
      {
        p: "P2",
        q: "Streaming with Suspense boundaries",
        topic: "Day 2 · Next.js",
        min: 20,
      },
      {
        p: "P2",
        q: "Testing a custom hook",
        topic: "Day 2 · Testing",
        min: 15,
      },
      {
        p: "—",
        q: "Questions you marked 'revise'",
        topic: "Day 3 · Review",
        min: 90,
      },
    ],
  },
  {
    id: "full",
    label: "Full curriculum",
    total: "126 questions · 12 topics",
    scope: "Every matched question, by topic",
    rows: [
      {
        p: "12",
        q: "React rendering and reconciliation",
        topic: "Topic",
        min: 240,
      },
      { p: "14", q: "JavaScript runtime and async", topic: "Topic", min: 280 },
      {
        p: "9",
        q: "Next.js routing, data and caching",
        topic: "Topic",
        min: 200,
      },
      { p: "11", q: "TypeScript types in practice", topic: "Topic", min: 170 },
      { p: "8", q: "Frontend system design", topic: "Topic", min: 320 },
      {
        p: "10",
        q: "Web performance and accessibility",
        topic: "Topic",
        min: 190,
      },
      {
        p: "7",
        q: "CSS layout and responsive design",
        topic: "Topic",
        min: 140,
      },
      { p: "9", q: "Testing and tooling", topic: "Topic", min: 160 },
    ],
  },
];

const fmt = (m: number) =>
  m >= 60
    ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim()
    : `${m} min`;

/** Click-only tabs: one ink pill slides to the chosen plan; the panel keeps one height. */
export function PrepTabs() {
  const [active, setActive] = useState(PLANS[0].id);
  const plan = PLANS.find((p) => p.id === active)!;
  return (
    <div>
      <div className="lp-tabs" role="tablist" aria-label="Prep plans">
        {PLANS.map((p) => (
          <button
            key={p.id}
            role="tab"
            id={`tab-${p.id}`}
            aria-selected={p.id === active}
            aria-controls="prep-panel"
            className="lp-tab"
            onClick={() => setActive(p.id)}
          >
            {p.id === active && (
              <motion.i layoutId="lp-tab-pill" className="lp-tab__pill" />
            )}
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      <div
        className="lp-prep"
        role="tabpanel"
        id="prep-panel"
        aria-labelledby={`tab-${active}`}
      >
        <div className="lp-prep__h">
          <span>
            <b>Northwind · Senior Frontend Engineer</b>
          </span>
          <span className="max-sm:hidden">{plan.total}</span>
        </div>
        {plan.rows.map((r) => (
          <div className="lp-q" key={r.q}>
            <span className="lp-q__p">{r.p}</span>
            <span className="lp-q__t">
              {r.q}
              <small>{r.topic}</small>
            </span>
            <span className="lp-q__m">{fmt(r.min)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
