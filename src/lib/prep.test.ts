import { describe, expect, it } from "vitest";
import {
  buildCrash,
  buildFull,
  buildMultiDay,
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
});

describe("buildCrash", () => {
  it("keeps P1 and frequent P2 only, within the budget", () => {
    const p1 = q({ priority: "P1", estMinutes: 30 });
    const hotP2 = q({ priority: "P2", frequency: 0.9, estMinutes: 30 });
    const p2 = q({ priority: "P2", frequency: 0.3, estMinutes: 10 });
    const p3 = q({ priority: "P3", frequency: 1, estMinutes: 5 });
    const ids = buildCrash([p1, hotP2, p2, p3], 360).map((i) => i.questionId);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(hotP2.id);
    expect(ids).not.toContain(p2.id);
    expect(ids).not.toContain(p3.id);
  });

  it("never exceeds the budget", () => {
    const pool = Array.from({ length: 30 }, () =>
      q({ priority: "P1", estMinutes: 25 }),
    );
    const items = buildCrash(pool, 120);
    const minutes = items.length * 25;
    expect(minutes).toBeLessThanOrEqual(120);
    expect(items).toHaveLength(4);
  });

  it("covers every topic before going deep on one", () => {
    const react = Array.from({ length: 6 }, () =>
      q({ topic: "React", priority: "P1", estMinutes: 30, frequency: 1 }),
    );
    const js = q({
      topic: "JavaScript",
      skills: ["javascript"],
      priority: "P1",
      estMinutes: 30,
      frequency: 0,
    });
    const css = q({
      topic: "CSS",
      skills: ["css"],
      priority: "P1",
      estMinutes: 30,
      frequency: 0,
    });
    const ids = buildCrash([...react, js, css], 90).map((i) => i.questionId);
    expect(ids).toHaveLength(3);
    expect(ids).toContain(js.id);
    expect(ids).toContain(css.id);
  });
});

describe("buildMultiDay", () => {
  it("puts P1 before P2 and leaves the last day for review", () => {
    const p2s = Array.from({ length: 4 }, () =>
      q({ priority: "P2", estMinutes: 60 }),
    );
    const p1s = Array.from({ length: 4 }, () =>
      q({ priority: "P1", estMinutes: 60 }),
    );
    const items = buildMultiDay([...p2s, ...p1s], 3, 240);
    const day1 = items.filter((i) => i.day === 1).map((i) => i.questionId);
    expect(day1.sort()).toEqual(p1s.map((x) => x.id).sort());
    expect(Math.max(...items.map((i) => i.day))).toBe(2);
  });

  it("respects the daily budget", () => {
    const pool = Array.from({ length: 20 }, () =>
      q({ priority: "P1", estMinutes: 50 }),
    );
    const items = buildMultiDay(pool, 4, 200);
    for (const day of [1, 2, 3]) {
      expect(
        items.filter((i) => i.day === day).length * 50,
      ).toBeLessThanOrEqual(200);
    }
  });

  it("clamps days to 2..14", () => {
    const pool = [q({ priority: "P1" })];
    expect(buildMultiDay(pool, 1)[0].day).toBe(1);
    expect(buildMultiDay(pool, 99)).toHaveLength(1);
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
