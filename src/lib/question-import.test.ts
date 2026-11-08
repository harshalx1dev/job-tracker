import { describe, expect, it } from "vitest";
import { parseCsv, parseQuestionFile } from "./question-import";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and newlines", () => {
    const rows = parseCsv('a,b\n"x, y","He said ""hi""\nthen left"\r\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x, y", 'He said "hi"\nthen left'],
    ]);
  });
});

describe("parseQuestionFile", () => {
  it("reads JSON with its own source and fills defaults", () => {
    const r = parseQuestionFile(
      "bank.json",
      JSON.stringify({
        source: { name: "Frontend bank", license: "CC BY 4.0" },
        questions: [
          {
            id: 1,
            topic: "React",
            skills: ["react"],
            priority: "p1",
            frequency: 0.9,
            minutes: 15,
            question: "What is a hook?",
            answer: "A function...",
          },
          {
            topic: "CSS",
            question: "What is specificity?",
            answer: "How the browser picks...",
          },
        ],
      }),
    );
    expect(r.source).toEqual({
      name: "Frontend bank",
      url: null,
      license: "CC BY 4.0",
    });
    expect(r.questions[0]).toMatchObject({
      externalId: "1",
      priority: "P1",
      frequency: 0.9,
      estMinutes: 15,
      needsReview: false,
    });
    // No priority given: defaults to P2 and is flagged for review; id is a stable hash.
    expect(r.questions[1]).toMatchObject({
      priority: "P2",
      needsReview: true,
      frequency: 0.5,
    });
    expect(r.questions[1].externalId).toMatch(/^[0-9a-f]{16}$/);
  });

  it("reads CSV with ;-separated lists and reports bad rows", () => {
    const csv = [
      "id,topic,skills,priority,question,answer,references",
      'q1,JavaScript,javascript;es6,P2,"What is a closure?","A function that remembers its scope",https://a.example;https://b.example',
      "q2,JavaScript,,,,missing question,",
      "q1,JavaScript,,P1,Duplicate id question here,ans,",
    ].join("\n");
    const r = parseQuestionFile("js.csv", csv, { name: "JS set" });
    expect(r.source.name).toBe("JS set");
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0]).toMatchObject({
      skills: ["javascript", "es6"],
      references: ["https://a.example", "https://b.example"],
    });
    expect(r.skipped.map((s) => s.reason)).toEqual([
      "question is missing",
      "duplicate id",
    ]);
  });

  it("rejects unknown formats and CSVs without required columns", () => {
    expect(() => parseQuestionFile("notes.md", "# hi")).toThrow(
      /json or \.csv/,
    );
    expect(() => parseQuestionFile("x.csv", "topic,question\nA,B")).toThrow(
      /answer/,
    );
  });
});
