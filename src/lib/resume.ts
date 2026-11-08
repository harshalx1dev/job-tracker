import { z } from "zod";
import { profileSchema, type Profile, type ProfileSection } from "./profile";

/** Sections a resume can show, in the order they print by default. */
export const RESUME_SECTIONS: { key: ProfileSection; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "experience", label: "Experience" },
  { key: "projects", label: "Projects" },
  { key: "skills", label: "Skills" },
  { key: "education", label: "Education" },
  { key: "certifications", label: "Certifications" },
];

export const TEMPLATES = [
  { id: "classic", label: "Classic", note: "Single column, serif headings" },
  {
    id: "column",
    label: "Column",
    note: "Skills and education in a side column",
  },
  { id: "compact", label: "Compact", note: "Dense, fits more on one page" },
] as const;

export const RESUME_ACCENTS = [
  "#1f2937",
  "#7a624e",
  "#1d4ed8",
  "#047857",
  "#b4232a",
  "#0f766e",
] as const;

export const designSchema = z.object({
  template: z.enum(["classic", "column", "compact"]),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  font: z.enum(["serif", "sans"]),
  density: z.enum(["comfortable", "compact"]),
  order: z.array(
    z.enum([
      "summary",
      "experience",
      "projects",
      "skills",
      "education",
      "certifications",
    ]),
  ),
  hidden: z.array(
    z.enum([
      "summary",
      "experience",
      "projects",
      "skills",
      "education",
      "certifications",
    ]),
  ),
});

export type ResumeDesign = z.infer<typeof designSchema>;
export type ResumeSectionKey = ResumeDesign["order"][number];

export const resumeContentSchema = profileSchema;

export function defaultDesign(): ResumeDesign {
  return {
    template: "classic",
    accent: RESUME_ACCENTS[0],
    font: "serif",
    density: "comfortable",
    order: RESUME_SECTIONS.map((s) => s.key) as ResumeSectionKey[],
    hidden: [],
  };
}

/** Sections to print, in order, skipping hidden and empty ones. */
export function visibleSections(
  content: Profile,
  design: ResumeDesign,
): ResumeSectionKey[] {
  return design.order.filter((key) => {
    if (design.hidden.includes(key)) return false;
    const v = content[key];
    return typeof v === "string" ? v.trim().length > 0 : v.length > 0;
  });
}

/** "2022-03" → "Mar 2022"; "2022" stays; "Present" stays. */
export function formatResumeDate(value: string) {
  const m = value.trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return value.trim();
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : value.trim();
}

export function dateRange(start: string, end: string) {
  const a = formatResumeDate(start);
  const b = formatResumeDate(end);
  if (a && b) return `${a} – ${b}`;
  return a || b;
}
