import { describe, expect, it } from "vitest";
import { checkLimits, limitsFor, wordCount } from "./outreach";

describe("outreach limits", () => {
  it("uses 200 characters for a LinkedIn note, 300 with Premium", () => {
    expect(limitsFor("linkedin_note").bodyMax).toBe(200);
    expect(limitsFor("linkedin_note", true).bodyMax).toBe(300);
    expect(limitsFor("linkedin_note").subjectMax).toBe(0);
  });

  it("Premium doesn't change other channels", () => {
    expect(limitsFor("linkedin_inmail", true)).toEqual({
      subjectMax: 200,
      bodyMax: 1900,
    });
  });

  it("flags drafts over the limit and drops subjects where the channel has none", () => {
    const [ok, over] = checkLimits(
      [
        { angle: "a", subject: "ignored", body: "x".repeat(200) },
        { angle: "b", subject: "", body: "x".repeat(201) },
      ],
      limitsFor("linkedin_note"),
    );
    expect(ok).toMatchObject({ over: false, subject: "" });
    expect(over.over).toBe(true);
  });

  it("flags an over-long email subject", () => {
    const [d] = checkLimits(
      [{ angle: "a", subject: "s".repeat(81), body: "hi" }],
      limitsFor("email"),
    );
    expect(d.over).toBe(true);
  });

  it("counts words", () => {
    expect(wordCount("  one two\nthree ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
});
