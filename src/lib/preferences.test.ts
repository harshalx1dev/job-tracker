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
      notes: "",
    });
  });

  it("falls back to empty on unusable stored data", () => {
    expect(readPreferences({ workModes: ["boat"] })).toEqual(
      emptyPreferences(),
    );
    expect(readPreferences(null)).toEqual(emptyPreferences());
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
