import { describe, expect, it } from "vitest";
import {
  BACKGROUND_MAX_CHARS,
  BACKGROUND_MAX_NOTES,
  MAX_ANSWER,
  backgroundToPrompt,
  freshQuestions,
  normalizeQuestion,
  questionUpdateSchema,
} from "./profile-questions";

describe("normalizeQuestion", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalizeQuestion("  How many users did the  portal serve?? ")).toBe(
      normalizeQuestion("how many users did the portal serve"),
    );
  });

  it("keeps other scripts and digits", () => {
    expect(normalizeQuestion("¿Cuántos 3 usuarios?")).toBe(
      "cuántos 3 usuarios",
    );
  });
});

describe("freshQuestions", () => {
  const q = (question: string) => ({ question, about: "" });

  it("drops repeats of existing questions in any wording of case or punctuation", () => {
    const out = freshQuestions(
      [q("What was the team size?"), q("What did you build first?")],
      ["what was the team size"],
      8,
    );
    expect(out.map((x) => x.question)).toEqual(["What did you build first?"]);
  });

  it("drops repeats within the batch and empty questions", () => {
    const out = freshQuestions([q("A?"), q("a"), q("  "), q("B?")], [], 8);
    expect(out.map((x) => x.question)).toEqual(["A?", "B?"]);
  });

  it("stops at the limit", () => {
    expect(freshQuestions([q("a"), q("b"), q("c")], [], 2)).toHaveLength(2);
  });
});

describe("questionUpdateSchema", () => {
  it("needs a real answer to mark a question answered", () => {
    expect(
      questionUpdateSchema.safeParse({ status: "answered", answer: "  " })
        .success,
    ).toBe(false);
    expect(
      questionUpdateSchema.safeParse({ status: "answered", answer: " ok " }),
    ).toMatchObject({ success: true, data: { answer: "ok" } });
  });

  it("limits the answer length", () => {
    expect(
      questionUpdateSchema.safeParse({
        status: "answered",
        answer: "x".repeat(MAX_ANSWER + 1),
      }).success,
    ).toBe(false);
  });

  it("takes na, unsure and pending without an answer, and nothing else", () => {
    for (const status of ["na", "unsure", "pending"])
      expect(questionUpdateSchema.safeParse({ status }).success).toBe(true);
    expect(questionUpdateSchema.safeParse({ status: "done" }).success).toBe(
      false,
    );
  });
});

describe("backgroundToPrompt", () => {
  it("is empty without notes", () => {
    expect(backgroundToPrompt([])).toBe("");
  });

  it("lists questions and answers", () => {
    expect(
      backgroundToPrompt([{ question: " Team size? ", answer: " Six. " }]),
    ).toBe(
      "Background the candidate added in their own words:\nQ: Team size?\nA: Six.",
    );
  });

  it("keeps only the newest notes up to the count limit", () => {
    const notes = Array.from({ length: BACKGROUND_MAX_NOTES + 5 }, (_, i) => ({
      question: `q${i}`,
      answer: "a",
    }));
    const out = backgroundToPrompt(notes);
    expect(out).toContain("Q: q0\n");
    expect(out).toContain(`Q: q${BACKGROUND_MAX_NOTES - 1}\n`);
    expect(out).not.toContain(`Q: q${BACKGROUND_MAX_NOTES}\n`);
  });

  it("stays within the size budget", () => {
    const notes = Array.from({ length: 20 }, (_, i) => ({
      question: `question ${i}`,
      answer: "x".repeat(900),
    }));
    expect(backgroundToPrompt(notes).length).toBeLessThanOrEqual(
      BACKGROUND_MAX_CHARS + 100,
    );
    expect(backgroundToPrompt(notes)).not.toContain("question 19");
  });
});
