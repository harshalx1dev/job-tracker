import { describe, expect, it } from "vitest";
import { emptyProfile, profileToPrompt, stripPlainFields } from "./profile";

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
