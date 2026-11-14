import { describe, expect, it } from "vitest";
import { applyReadiness, type ReadinessInput } from "./apply-readiness";

const ready = (over: Partial<ReadinessInput> = {}): ReadinessInput => ({
  applyWithAi: true,
  stageName: "Ready to apply",
  applications: [
    {
      outcome: "prepared",
      createdAt: "2026-11-15T10:00:00Z",
      submitted: [{ field: "Notice period", value: "Serving" }],
    },
  ],
  ...over,
});

describe("applyReadiness", () => {
  it("allows a ticked job in the right stage with every field answered", () => {
    expect(applyReadiness(ready())).toMatchObject({
      eligible: true,
      reasons: [],
    });
  });

  it("needs the tick", () => {
    expect(applyReadiness(ready({ applyWithAi: false })).eligible).toBe(false);
  });

  it("needs the Ready to apply stage (any letter case)", () => {
    expect(
      applyReadiness(ready({ stageName: "ready to APPLY" })).eligible,
    ).toBe(true);
    expect(applyReadiness(ready({ stageName: "Wishlist" })).eligible).toBe(
      false,
    );
  });

  it("blocks on an empty or flagged field and names it", () => {
    const r = applyReadiness(
      ready({
        applications: [
          {
            outcome: "prepared",
            createdAt: "2026-11-15T10:00:00Z",
            submitted: [
              { field: "Current CTC", value: "", missing: true },
              { field: "Notice period", value: "  " },
              { field: "Location", value: "Mumbai" },
            ],
          },
        ],
      }),
    );
    expect(r.eligible).toBe(false);
    expect(r.missingFields).toEqual(["Current CTC", "Notice period"]);
  });

  it("uses the newest prepared record", () => {
    const r = applyReadiness(
      ready({
        applications: [
          {
            outcome: "prepared",
            createdAt: "2026-11-14T10:00:00Z",
            submitted: [{ field: "Old", value: "", missing: true }],
          },
          {
            outcome: "prepared",
            createdAt: "2026-11-15T10:00:00Z",
            submitted: [{ field: "New", value: "answered" }],
          },
        ],
      }),
    );
    expect(r.eligible).toBe(true);
  });

  it("never allows a second application once one is recorded as applied", () => {
    const r = applyReadiness(
      ready({
        applications: [
          ...ready().applications,
          {
            outcome: "applied",
            createdAt: "2026-11-16T10:00:00Z",
            submitted: [],
          },
        ],
      }),
    );
    expect(r.eligible).toBe(false);
  });

  it("needs prepared answers to exist", () => {
    expect(applyReadiness(ready({ applications: [] })).eligible).toBe(false);
  });
});
