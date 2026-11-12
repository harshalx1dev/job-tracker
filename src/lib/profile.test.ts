import { describe, expect, it } from "vitest";
import { z } from "zod";
import { clampToSchema } from "./ai-schema";
import {
  emptyProfile,
  profileSchema,
  profileToPrompt,
  stripPlainFields,
} from "./profile";

describe("stripPlainFields", () => {
  it("removes markers from plain fields but keeps them in rich ones", () => {
    const p = emptyProfile();
    p.basics.name = "**Jane Doe**";
    p.summary = "Builds **fast** sites";
    p.experience = [
      {
        company: "*Acme*",
        title: "**Engineer**",
        location: "",
        start: "2022-01",
        end: "Present",
        highlights: ["## Portal", "**Shipped** it"],
      },
    ];
    p.skills = [{ group: "**Core**", items: ["**JS**"] }];

    const out = stripPlainFields(p);
    expect(out.basics.name).toBe("Jane Doe");
    expect(out.experience[0].company).toBe("Acme");
    expect(out.experience[0].title).toBe("Engineer");
    expect(out.skills[0]).toEqual({ group: "Core", items: ["JS"] });
    expect(out.summary).toBe("Builds **fast** sites");
    expect(out.experience[0].highlights).toEqual([
      "## Portal",
      "**Shipped** it",
    ]);
  });
});

describe("highlight limit", () => {
  // A role with three named groups of four bullets: 3 headings + 12 bullets.
  const lines = [1, 2, 3].flatMap((g) => [
    `## Project ${g}`,
    ...[1, 2, 3, 4].map((b) => `Bullet ${g}.${b}`),
  ]);

  it("saves a role whose headings and bullets pass 12 lines", () => {
    const p = emptyProfile();
    p.experience = [
      {
        company: "Acme",
        title: "Engineer",
        location: "",
        start: "2022",
        end: "",
        highlights: lines,
      },
    ];
    expect(lines).toHaveLength(15);
    expect(profileSchema.safeParse(p).success).toBe(true);
  });

  it("does not trim those lines when the AI result is clamped", () => {
    const json = z.toJSONSchema(profileSchema, { target: "draft-7" });
    const p = emptyProfile();
    p.experience = [
      {
        company: "Acme",
        title: "Engineer",
        location: "",
        start: "2022",
        end: "",
        highlights: lines,
      },
    ];
    const clamped = clampToSchema(p, json) as typeof p;
    expect(clamped.experience[0].highlights).toEqual(lines);
  });
});

describe("profileToPrompt", () => {
  it("shows plain words, with sub-headings as labels", () => {
    const p = emptyProfile();
    p.experience = [
      {
        company: "Acme",
        title: "Engineer",
        location: "",
        start: "2022",
        end: "",
        highlights: ["## Portal", "**Shipped** it"],
      },
    ];
    expect(profileToPrompt(p)).toContain("  Portal:\n  - Shipped it");
  });
});
