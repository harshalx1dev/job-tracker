import { z } from "zod";

/**
 * The canonical profile: one per user. Resume parsing fills it, the profile
 * editor edits it, and every AI feature reads it as context. Kept to plain
 * strings and arrays so it also works as a structured-output schema for Gemini.
 */

const text = (max: number, describe?: string) => {
  const s = z.string().max(max);
  return describe ? s.describe(describe) : s;
};

export const linkSchema = z.object({
  label: text(40, "e.g. GitHub, Portfolio, LinkedIn"),
  url: text(300),
});

export const experienceSchema = z.object({
  company: text(120),
  title: text(120),
  location: text(120).describe("City or Remote; empty if unknown"),
  url: text(300).describe("Company website; empty if none").optional(),
  start: text(20).describe("YYYY-MM or YYYY"),
  end: text(20).describe("YYYY-MM, YYYY or Present"),
  highlights: z
    .array(text(400))
    .max(12)
    .describe("Achievement bullets, as written"),
});

export const projectSchema = z.object({
  name: text(120),
  subtitle: text(200)
    .describe(
      "Short line under the name, e.g. client or context; empty if none",
    )
    .optional(),
  description: text(600),
  highlights: z
    .array(text(400))
    .max(12)
    .describe("Bullets, as written")
    .optional(),
  tech: z.array(text(40)).max(20),
  url: text(300).describe("Empty if none"),
});

export const educationSchema = z.object({
  school: text(160),
  degree: text(160),
  field: text(160),
  start: text(20),
  end: text(20),
  location: text(120).optional(),
  details: z
    .array(text(300))
    .max(6)
    .describe("Extra lines such as grade or honours")
    .optional(),
});

export const skillGroupSchema = z.object({
  group: text(60).describe(
    "e.g. Languages, Frameworks, Tools; empty when the resume lists skills without groups",
  ),
  items: z.array(text(60)).max(40),
});

export const certificationSchema = z.object({
  name: text(160),
  issuer: text(160),
  year: text(10),
  url: text(300).describe("Certificate link; empty if none").optional(),
});

export const profileSchema = z.object({
  basics: z.object({
    name: text(120),
    headline: text(160).describe(
      "Current role or a short title, e.g. Senior Frontend Engineer",
    ),
    email: text(200),
    phone: text(40),
    location: text(120),
    links: z.array(linkSchema).max(10),
  }),
  summary: text(2000).describe(
    "Professional summary as written; empty if none",
  ),
  experience: z.array(experienceSchema).max(20),
  projects: z.array(projectSchema).max(20),
  education: z.array(educationSchema).max(10),
  skills: z.array(skillGroupSchema).max(12),
  certifications: z.array(certificationSchema).max(20),
  /** Anything else the AI should know (preferences, notice period, visa). Never parsed. */
  extra: text(3000),
});

export type Profile = z.infer<typeof profileSchema>;
export type ProfileSection = Exclude<keyof Profile, "extra">;

export const PROFILE_SECTIONS: { key: ProfileSection; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "summary", label: "Summary" },
  { key: "experience", label: "Experience" },
  { key: "projects", label: "Projects" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
  { key: "certifications", label: "Certifications" },
];

export function emptyProfile(): Profile {
  return {
    basics: {
      name: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      links: [],
    },
    summary: "",
    experience: [],
    projects: [],
    education: [],
    skills: [],
    certifications: [],
    extra: "",
  };
}

/** Takes the chosen sections from a parsed resume; everything else stays as it was. */
export function mergeProfile(
  current: Profile,
  parsed: Profile,
  sections: ProfileSection[],
): Profile {
  const next = structuredClone(current);
  for (const key of sections) {
    // Each section is replaced whole: merging lists item by item guesses wrong too often.
    (next as Record<ProfileSection, unknown>)[key] = structuredClone(
      parsed[key],
    );
  }
  return next;
}

/** Counts how filled-in each section is, for the editor's sidebar and review screen. */
export function sectionSize(p: Profile, key: ProfileSection): number {
  const v = p[key];
  if (typeof v === "string") return v.trim() ? 1 : 0;
  if (Array.isArray(v)) return v.length;
  return Object.values(v).filter((x) =>
    Array.isArray(x) ? x.length : String(x).trim(),
  ).length;
}

/** Plain-text rendering of the profile for prompts (compact, no JSON noise). */
export function profileToPrompt(p: Profile): string {
  const lines: string[] = [];
  const b = p.basics;
  lines.push(
    `${b.name}${b.headline ? ` — ${b.headline}` : ""}${b.location ? ` (${b.location})` : ""}`,
  );
  if (p.summary) lines.push(`Summary: ${p.summary}`);
  for (const e of p.experience) {
    lines.push(
      `Experience: ${e.title} at ${e.company} (${e.start}–${e.end || "Present"})`,
    );
    for (const h of e.highlights) lines.push(`  - ${h}`);
  }
  for (const pr of p.projects) {
    lines.push(
      `Project: ${pr.name}${pr.tech.length ? ` [${pr.tech.join(", ")}]` : ""}: ${pr.description}`,
    );
  }
  for (const s of p.skills)
    lines.push(`Skills (${s.group}): ${s.items.join(", ")}`);
  for (const ed of p.education)
    lines.push(`Education: ${ed.degree} ${ed.field}, ${ed.school} (${ed.end})`);
  for (const c of p.certifications)
    lines.push(`Certification: ${c.name}, ${c.issuer} ${c.year}`);
  if (p.extra) lines.push(`Other context from the candidate: ${p.extra}`);
  return lines.join("\n");
}
