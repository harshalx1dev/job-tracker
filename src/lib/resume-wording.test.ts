import { describe, expect, it } from "vitest";
import { emptyProfile, type Profile } from "./profile";
import { applyWording, WordingError } from "./resume-wording";

function profile(): Profile {
  const p = emptyProfile();
  p.basics = { ...p.basics, name: "Jane Doe", email: "jane@x.dev" };
  p.summary = "Original summary";
  p.experience = [
    {
      company: "Acme",
      title: "Engineer",
      location: "Mumbai",
      url: "https://acme.dev",
      start: "2022-01",
      end: "Present",
      highlights: ["Built things"],
    },
    {
      company: "Globex",
      title: "Intern",
      location: "",
      start: "2021-01",
      end: "2021-06",
      highlights: [],
    },
    {
      company: "Globex",
      title: "Analyst",
      location: "",
      start: "2021-07",
      end: "2021-12",
      highlights: [],
    },
  ];
  p.projects = [
    {
      name: "Portal",
      description: "Old description",
      highlights: ["Old bullet"],
      tech: ["React"],
      url: "https://portal.dev",
    },
  ];
  return p;
}

describe("applyWording", () => {
  it("rewords the summary, a role's highlights and a project, leaving the original untouched", () => {
    const original = profile();
    const out = applyWording(original, {
      summary: "New summary",
      experience: [{ company: "acme", highlights: ["**Shipped** it"] }],
      projects: [
        { name: "PORTAL", description: "New description", highlights: ["New"] },
      ],
    });
    expect(out.summary).toBe("New summary");
    expect(out.experience[0].highlights).toEqual(["**Shipped** it"]);
    expect(out.projects[0].description).toBe("New description");
    expect(out.projects[0].highlights).toEqual(["New"]);
    // The input is a different object and was not changed.
    expect(original).toEqual(profile());
  });

  it("never changes facts: names, companies, titles, dates, locations, links, tech", () => {
    const base = profile();
    const out = applyWording(base, {
      summary: "x",
      experience: [{ company: "Acme", highlights: ["y"] }],
      projects: [{ name: "Portal", description: "z", highlights: ["w"] }],
    });
    expect(out.basics).toEqual(base.basics);
    expect(out.education).toEqual(base.education);
    expect(out.skills).toEqual(base.skills);
    expect(out.certifications).toEqual(base.certifications);
    // Same role apart from its highlights (the one thing that was reworded).
    expect({ ...out.experience[0], highlights: [] }).toEqual({
      ...base.experience[0],
      highlights: [],
    });
    expect(out.experience.slice(1)).toEqual(base.experience.slice(1));
    expect(out.projects[0].name).toBe("Portal");
    expect(out.projects[0].tech).toEqual(["React"]);
    expect(out.projects[0].url).toBe("https://portal.dev");
  });

  it("only changes what is in the patch", () => {
    const base = profile();
    const out = applyWording(base, { summary: "Only this" });
    expect(out.experience).toEqual(base.experience);
    expect(out.projects).toEqual(base.projects);
  });

  it("refuses roles and projects that don't exist, naming the real ones", () => {
    expect(() =>
      applyWording(profile(), {
        experience: [{ company: "Initech", highlights: ["x"] }],
      }),
    ).toThrow(/No role at "Initech".*Acme \(Engineer\)/);
    expect(() =>
      applyWording(profile(), {
        projects: [{ name: "Nope", description: "x" }],
      }),
    ).toThrow(/No project named "Nope".*Portal/);
  });

  it("needs the title when a company has several roles, and then picks the right one", () => {
    expect(() =>
      applyWording(profile(), {
        experience: [{ company: "Globex", highlights: ["x"] }],
      }),
    ).toThrow(WordingError);
    const out = applyWording(profile(), {
      experience: [{ company: "Globex", title: "Analyst", highlights: ["ok"] }],
    });
    expect(out.experience[2].highlights).toEqual(["ok"]);
    expect(out.experience[1].highlights).toEqual([]);
  });
});
