import { describe, expect, it } from "vitest";
import {
  emptyPreferences,
  preferencesSchema,
  readPreferences,
} from "./preferences";

describe("preferences", () => {
  it("starts empty with a modest session limit", () => {
    expect(emptyPreferences()).toEqual({
      roles: "",
      locations: "",
      workModes: [],
      salary: "",
      avoid: "",
      maxPerSession: 5,
      minScore: 70,
      sources: ["linkedin", "naukri", "instahyre", "posts"],
      summaryEmail: false,
      notes: "",
    });
  });

  it("falls back to empty on unusable stored data", () => {
    expect(readPreferences({ workModes: ["boat"] })).toEqual(
      emptyPreferences(),
    );
    expect(readPreferences(null)).toEqual(emptyPreferences());
  });

  it("keeps summary emails off unless the user turns them on", () => {
    expect(preferencesSchema.parse({}).summaryEmail).toBe(false);
    expect(readPreferences({ roles: "x" }).summaryEmail).toBe(false);
    expect(preferencesSchema.parse({ summaryEmail: true }).summaryEmail).toBe(
      true,
    );
  });

  it("searches four sources until the user changes them, and rejects unknown ones", () => {
    expect(readPreferences({ roles: "x" }).sources).toEqual([
      "linkedin",
      "naukri",
      "instahyre",
      "posts",
    ]);
    expect(preferencesSchema.parse({ sources: ["hirist"] }).sources).toEqual([
      "hirist",
    ]);
    expect(preferencesSchema.safeParse({ sources: ["orkut"] }).success).toBe(
      false,
    );
  });

  it("keeps the minimum score between 0 and 100", () => {
    expect(preferencesSchema.safeParse({ minScore: 101 }).success).toBe(false);
    expect(preferencesSchema.safeParse({ minScore: -1 }).success).toBe(false);
    expect(preferencesSchema.parse({ minScore: 80 }).minScore).toBe(80);
  });

  it("limits how many jobs one session may handle", () => {
    expect(preferencesSchema.safeParse({ maxPerSession: 0 }).success).toBe(
      false,
    );
    expect(preferencesSchema.safeParse({ maxPerSession: 51 }).success).toBe(
      false,
    );
  });
});
