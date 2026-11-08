import { describe, expect, it } from "vitest";
import { generateKeyBetween } from "fractional-indexing";
import { niceTicks } from "@/lib/chart-ticks";
import { statusColor, STATUS_COLORS } from "@/lib/status-colors";
import {
  formatSalary,
  groupIds,
  matchesQuery,
  type Job,
  type Status,
} from "./utils";

const status = (id: string, position: number) => ({ id, position }) as Status;
const job = (
  id: string,
  statusId: string,
  position: string,
  extra: Partial<Job> = {},
) =>
  ({
    id,
    statusId,
    position,
    company: "Co",
    title: "Dev",
    location: null,
    skills: [],
    ...extra,
  }) as Job;

describe("groupIds", () => {
  it("groups jobs by stage, ordered by fractional position (bytewise)", () => {
    const a = generateKeyBetween(null, null);
    const c = generateKeyBetween(a, null);
    const b = generateKeyBetween(a, c); // inserted between a and c
    const cols = groupIds(
      [status("s1", 0), status("s2", 1)],
      [
        job("3", "s1", c),
        job("1", "s1", a),
        job("2", "s1", b),
        job("x", "s2", a),
      ],
    );
    expect(cols).toEqual({ s1: ["1", "2", "3"], s2: ["x"] });
  });

  it("keeps empty stages as empty columns", () => {
    expect(groupIds([status("s1", 0)], [])).toEqual({ s1: [] });
  });
});

describe("fractional ordering used by drag and drop", () => {
  it("can always insert between two neighbours", () => {
    let lo = generateKeyBetween(null, null);
    const hi = generateKeyBetween(lo, null);
    // 50 inserts in the same gap stay strictly ordered.
    for (let i = 0; i < 50; i++) {
      const mid = generateKeyBetween(lo, hi);
      expect(mid > lo && mid < hi).toBe(true);
      lo = mid;
    }
  });
});

describe("formatSalary", () => {
  it("formats a range compactly with its currency", () => {
    expect(
      formatSalary({
        salaryMin: 3_800_000,
        salaryMax: 4_500_000,
        currency: "INR",
      }),
    ).toBe("INR 3.8M–4.5M");
  });
  it("shows a single figure when only one end is set", () => {
    expect(
      formatSalary({ salaryMin: null, salaryMax: 120_000, currency: null }),
    ).toBe("120K");
  });
  it("returns null without a salary", () => {
    expect(
      formatSalary({ salaryMin: null, salaryMax: null, currency: null }),
    ).toBeNull();
  });
});

describe("matchesQuery", () => {
  const j = job("1", "s1", "a0", {
    company: "Northwind",
    title: "Senior Engineer",
    skills: ["React"],
  });
  it("matches company, title and skills, case-insensitively", () => {
    expect(matchesQuery(j, "north")).toBe(true);
    expect(matchesQuery(j, "SENIOR")).toBe(true);
    expect(matchesQuery(j, "react")).toBe(true);
    expect(matchesQuery(j, "vue")).toBe(false);
    expect(matchesQuery(j, "")).toBe(true);
  });
});

describe("niceTicks", () => {
  it("produces clean whole-number steps from zero", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(23)).toEqual([0, 10, 20, 30]);
  });
});

describe("statusColor", () => {
  it("maps legacy violet and indigo to the new palette", () => {
    expect(statusColor("violet")).toBe(STATUS_COLORS.teal);
    expect(statusColor("indigo")).toBe(STATUS_COLORS.blue);
    expect(statusColor("unknown")).toBe(STATUS_COLORS.slate);
  });
});
