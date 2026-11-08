import { describe, expect, it } from "vitest";
import { LIMITS, limitVerdict } from "./limits";

describe("AI rate limits", () => {
  it("allows calls under both windows and reports what's left today", () => {
    expect(limitVerdict("user", 0, 0)).toEqual({
      ok: true,
      remainingToday: LIMITS.user.perDay,
    });
    expect(limitVerdict("user", 10, 100)).toEqual({
      ok: true,
      remainingToday: 200,
    });
  });

  it("blocks at the hourly cap first", () => {
    expect(limitVerdict("user", LIMITS.user.perHour, 70)).toMatchObject({
      ok: false,
      window: "hour",
    });
  });

  it("blocks at the daily cap", () => {
    expect(limitVerdict("user", 0, LIMITS.user.perDay)).toMatchObject({
      ok: false,
      window: "day",
    });
  });

  it("gives the admin key a higher allowance", () => {
    expect(limitVerdict("admin", LIMITS.user.perHour, 0).ok).toBe(true);
  });
});
