import { describe, expect, it } from "vitest";
import { bandFor, breakdownProblem, type BreakdownItem } from "./match-scoring";

const b = (s: number, r: number, w: number, c: number): BreakdownItem[] => [
  { factor: "skills", points: s, reason: "x" },
  { factor: "role", points: r, reason: "x" },
  { factor: "work", points: w, reason: "x" },
  { factor: "conditions", points: c, reason: "x" },
];

describe("breakdownProblem", () => {
  it("accepts no breakdown, and a breakdown that adds up", () => {
    expect(breakdownProblem({ score: 70 })).toBeNull();
    expect(
      breakdownProblem({ score: 70, breakdown: b(35, 12, 12, 11) }),
    ).toBeNull();
  });
  it("says what to fix when the sum is wrong, a factor is missing or too high", () => {
    expect(
      breakdownProblem({ score: 80, breakdown: b(35, 12, 12, 11) }),
    ).toMatch(/add up to 70/);
    expect(
      breakdownProblem({ score: 60, breakdown: b(35, 12, 12, 11).slice(0, 3) }),
    ).toMatch(/missing: conditions/);
    expect(breakdownProblem({ score: 60, breakdown: b(51, 5, 2, 2) })).toMatch(
      /out of 50/,
    );
  });
  it("lets a dealbreaker cap the score at 40", () => {
    expect(
      breakdownProblem({
        score: 40,
        cappedBy: "needs relocation",
        breakdown: b(40, 15, 10, 5),
      }),
    ).toBeNull();
    expect(
      breakdownProblem({
        score: 55,
        cappedBy: "x",
        breakdown: b(40, 15, 10, 5),
      }),
    ).toMatch(/at most 40/);
  });
});

describe("bandFor", () => {
  it("follows the rubric ranges", () => {
    expect(
      [29, 30, 49, 50, 69, 70, 84, 85].map((n) => bandFor(n).meaning),
    ).toEqual([
      "Poor",
      "Weak",
      "Weak",
      "Partial",
      "Partial",
      "Good",
      "Good",
      "Strong",
    ]);
  });
});
