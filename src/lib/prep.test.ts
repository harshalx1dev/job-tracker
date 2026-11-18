import { describe, expect, it } from "vitest";
import {
  buildCrash,
  buildFull,
  buildMultiDay,
  dropRepeats,
  estimateMinutes,
  matchQuestions,
  normalizeSkill,
  suggestPlan,
  valueOf,
  type BankQuestion,
} from "./prep";

let n = 0;
const q = (p: Partial<BankQuestion> = {}): BankQuestion => ({
  id: `q${String(++n).padStart(3, "0")}`,
  topic: "React",
  skills: ["react"],
  priority: "P2",
  frequency: 0.5,
  estMinutes: 20,
  ...p,
});

describe("normalizeSkill / matchQuestions", () => {
  it("treats common spellings as the same skill", () => {
    expect(normalizeSkill("React.js")).toBe("react");
    expect(normalizeSkill(" ReactJS ")).toBe("react");
    expect(normalizeSkill("NextJS")).toBe("next.js");
    expect(normalizeSkill("TS")).toBe("typescript");
  });

  it("matches by skill or by topic, and nothing without job skills", () => {
    const a = q({ skills: ["React.js"] });
    const b = q({ topic: "TypeScript", skills: [] });
    const c = q({ topic: "Go", skills: ["golang"] });
    expect(matchQuestions([a, b, c], ["react", "ts"]).map((x) => x.id)).toEqual(
      [a.id, b.id],
    );
    expect(matchQuestions([a, b, c], [])).toEqual([]);
  });

  it("brings implied skills in and keeps other technologies out", () => {
    const js = q({ topic: "JavaScript", skills: ["javascript"] });
    const aemPerf = q({ topic: "AEM", skills: ["aem", "performance"] });
    const vitals = q({ topic: "Performance & SEO", skills: ["performance"] });
    const tsGenerics = q({
      topic: "TypeScript",
      skills: ["typescript", "react"],
    });
    const picked = matchQuestions(
      [js, aemPerf, vitals, tsGenerics],
      ["React", "Performance"],
    ).map((x) => x.id);
    expect(picked).toEqual([js.id, vitals.id]);
    // EDS roles get AEM questions too.
    expect(matchQuestions([aemPerf], ["Edge Delivery Services"])).toEqual([
      aemPerf,
    ]);
  });
});

describe("buildCrash", () => {
  it("takes every P1 and nothing else", () => {
    const p1s = Array.from({ length: 30 }, () =>
      q({ priority: "P1", estMinutes: 40 }),
    );
    const p2 = q({ priority: "P2", frequency: 1 });
    const p3 = q({ priority: "P3", frequency: 1 });
    const ids = buildCrash([...p1s, p2, p3]).map((i) => i.questionId);
    expect(ids.sort()).toEqual(p1s.map((x) => x.id).sort());
  });

  it("puts the job's own skills first, in posting order, and output puzzles last in a topic", () => {
    const css = q({ topic: "CSS", skills: ["css"], priority: "P1" });
    const js = q({
      topic: "JavaScript",
      skills: ["javascript"],
      priority: "P1",
    });
    const puzzle = q({
      topic: "JavaScript",
      skills: ["javascript"],
      subtopic: "Output Questions",
      priority: "P1",
      estMinutes: 5,
      frequency: 1,
    });
    const aem = q({
      topic: "AEM",
      skills: ["aem"],
      priority: "P1",
      frequency: 0,
    });
    const ids = buildCrash(
      [css, puzzle, js, aem],
      ["AEM", "JavaScript", "CSS3"],
    );
    expect(ids.map((i) => i.questionId)).toEqual([
      aem.id,
      js.id,
      puzzle.id,
      css.id,
    ]);
  });
});

describe("buildMultiDay", () => {
  it("takes every P1 then every P2, no P3, and leaves the last day for review", () => {
    const p2s = Array.from({ length: 4 }, () =>
      q({ priority: "P2", estMinutes: 60 }),
    );
    const p1s = Array.from({ length: 4 }, () =>
      q({ priority: "P1", estMinutes: 60 }),
    );
    const p3 = q({ priority: "P3" });
    const items = buildMultiDay([...p2s, ...p1s, p3], 3, 240);
    expect(items).toHaveLength(8);
    expect(items.map((i) => i.questionId)).not.toContain(p3.id);
    const day1 = items.filter((i) => i.day === 1).map((i) => i.questionId);
    expect(day1.sort()).toEqual(p1s.map((x) => x.id).sort());
    expect(Math.max(...items.map((i) => i.day))).toBe(2);
  });

  it("spreads a long list evenly instead of dropping questions", () => {
    const pool = Array.from({ length: 20 }, () =>
      q({ priority: "P1", estMinutes: 50 }),
    );
    const items = buildMultiDay(pool, 4, 200);
    expect(items).toHaveLength(20);
    const perDay = [1, 2, 3].map(
      (d) => items.filter((i) => i.day === d).length,
    );
    expect(Math.max(...perDay) - Math.min(...perDay)).toBeLessThanOrEqual(1);
    expect(items.some((i) => i.day === 4)).toBe(false);
  });

  it("clamps days to 2..14", () => {
    const pool = [q({ priority: "P1" })];
    expect(buildMultiDay(pool, 1)[0].day).toBe(1);
    expect(buildMultiDay(pool, 99)).toHaveLength(1);
  });
});

describe("dropRepeats and the tag gate", () => {
  it("drops a near-copy question, keeping the higher priority one", () => {
    const keep = q({
      priority: "P1",
      question: "Cookies vs localStorage vs sessionStorage",
    });
    const copy = q({
      priority: "P2",
      question: "localStorage vs sessionStorage vs cookies",
    });
    const other = q({ priority: "P2", question: "What is event delegation?" });
    expect(dropRepeats([copy, keep, other]).map((x) => x.id)).toEqual(
      [keep.id, other.id].sort(
        (x, y) =>
          [copy, keep, other].findIndex((z) => z.id === x) -
          [copy, keep, other].findIndex((z) => z.id === y),
      ),
    );
  });

  it("keeps output puzzles that differ by one word", () => {
    const a = q({
      question: "What logs? arrow function inside setTimeout using this.name",
    });
    const b = q({
      question: "What logs? regular function inside setTimeout using this.name",
    });
    expect(dropRepeats([a, b])).toHaveLength(2);
  });

  it("keeps a React-tagged JavaScript question out of a job without React", () => {
    const tagged = q({ topic: "JavaScript", skills: ["javascript", "react"] });
    const plain = q({ topic: "JavaScript", skills: ["javascript"] });
    expect(
      matchQuestions([tagged, plain], ["javascript"]).map((x) => x.id),
    ).toEqual([plain.id]);
    expect(matchQuestions([tagged, plain], ["react"]).map((x) => x.id)).toEqual(
      [tagged.id, plain.id],
    );
  });
});

describe("buildFull and helpers", () => {
  it("includes everything, grouped by topic, P1 first", () => {
    const a = q({ topic: "React", priority: "P3" });
    const b = q({ topic: "CSS", skills: ["css"], priority: "P2" });
    const c = q({ topic: "React", priority: "P1" });
    expect(buildFull([a, b, c]).map((i) => i.questionId)).toEqual([
      b.id,
      c.id,
      a.id,
    ]);
  });

  it("values priority and frequency", () => {
    expect(valueOf(q({ priority: "P1", frequency: 1 }))).toBeGreaterThan(
      valueOf(q({ priority: "P2", frequency: 1 })),
    );
    expect(valueOf(q({ priority: "P2", frequency: 1 }))).toBeGreaterThan(
      valueOf(q({ priority: "P2", frequency: 0 })),
    );
  });

  it("suggests a plan from the interview date", () => {
    const now = new Date("2026-11-08T10:00:00Z");
    expect(suggestPlan(new Date("2026-11-09T09:00:00Z"), now).kind).toBe(
      "crash",
    );
    expect(suggestPlan(new Date("2026-11-12T09:00:00Z"), now)).toEqual({
      kind: "multiday",
      days: 4,
    });
    expect(suggestPlan(null, now)).toEqual({ kind: "multiday", days: 3 });
  });

  it("estimates study time in 5-minute steps between 5 and 45", () => {
    expect(estimateMinutes("short")).toBe(5);
    expect(estimateMinutes("word ".repeat(400))).toBe(45);
  });
});
