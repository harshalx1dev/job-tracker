import { z } from "zod";
import { profileSchema, type Profile, type ProfileSection } from "./profile";

/** Sections a resume can show, in the order they print by default. */
export const RESUME_SECTIONS: { key: ProfileSection; label: string }[] = [
  { key: "skills", label: "Skills" },
  { key: "summary", label: "Professional summary" },
  { key: "experience", label: "Professional experience" },
  { key: "projects", label: "Projects" },
  { key: "education", label: "Education" },
  { key: "certifications", label: "Certifications" },
];

const SECTION_KEYS = [
  "summary",
  "experience",
  "projects",
  "skills",
  "education",
  "certifications",
] as const;

/** Fonts the resume can use (loaded in features/resumes/resume-fonts.ts). */
export const RESUME_FONTS = [
  { id: "open-sans", label: "Open Sans", kind: "sans" },
  { id: "source-sans", label: "Source Sans 3", kind: "sans" },
  { id: "lato", label: "Lato", kind: "sans" },
  { id: "inter", label: "Inter", kind: "sans" },
  { id: "merriweather", label: "Merriweather", kind: "serif" },
  { id: "source-serif", label: "Source Serif 4", kind: "serif" },
] as const;
export type ResumeFont = (typeof RESUME_FONTS)[number]["id"];

export const RESUME_ACCENTS = [
  "#111827",
  "#1f3a5f",
  "#1d4ed8",
  "#0f766e",
  "#047857",
  "#7a624e",
  "#b4232a",
  "#6d28d9",
] as const;

/** Where the accent colour is applied. */
export const ACCENT_TARGETS = [
  { id: "name", label: "Name" },
  { id: "headings", label: "Headings" },
  { id: "rule", label: "Heading line" },
  { id: "icons", label: "Header icons" },
  { id: "links", label: "Links" },
  { id: "dates", label: "Dates" },
  { id: "titles", label: "Entry titles" },
] as const;
type AccentTarget = (typeof ACCENT_TARGETS)[number]["id"];

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const fontIds = RESUME_FONTS.map((f) => f.id) as [ResumeFont, ...ResumeFont[]];

/**
 * Everything the resume looks like. Every field has a fallback (`.catch`), so
 * designs saved by older versions load with sensible values for new options.
 */
export const designSchema = z.object({
  template: z
    .preprocess(
      // Retired templates map onto the two that remain.
      (v) =>
        v === "classic"
          ? "modern"
          : v === "column" || v === "compact"
            ? "professional"
            : v,
      z.enum(["professional", "modern"]),
    )
    .catch("professional"),
  pageSize: z.enum(["A4", "Letter"]).catch("A4"),
  font: z
    .preprocess(
      // Older designs stored "serif" / "sans".
      (v) => (v === "serif" ? "source-serif" : v === "sans" ? "open-sans" : v),
      z.enum(fontIds),
    )
    .catch("open-sans"),
  /** Base size in points. */
  fontSize: z.number().min(8.5).max(12.5).catch(10.5),
  lineHeight: z.number().min(1.1).max(1.7).catch(1.35),
  /** Page margin in millimetres (all sides). */
  margin: z.number().min(8).max(25).catch(14),
  /** Space between sections in millimetres. */
  sectionGap: z.number().min(2).max(10).catch(5),
  headerAlign: z.enum(["left", "center"]).catch("center"),
  /** Centred header only: the headline next to the name, or on its own line below it. */
  headlinePosition: z.enum(["beside", "below"]).catch("beside"),
  contactStyle: z.enum(["icons", "dots", "bars"]).catch("icons"),
  headingCase: z.enum(["upper", "title"]).catch("upper"),
  headingRule: z.enum(["none", "thin", "thick"]).catch("thick"),
  datePosition: z.enum(["right", "below"]).catch("right"),
  subtitle: z.enum(["inline", "below"]).catch("inline"),
  dateFormat: z.enum(["MM/YYYY", "Mon YYYY", "YYYY"]).catch("MM/YYYY"),
  linkUnderline: z.boolean().catch(true),
  linkIcon: z.boolean().catch(true),
  accent: hex.catch(RESUME_ACCENTS[0]),
  accentOn: z
    .array(z.enum(ACCENT_TARGETS.map((t) => t.id) as [AccentTarget]))
    .catch(["headings", "rule", "icons"]),
  order: z
    .array(z.enum(SECTION_KEYS))
    .catch(
      RESUME_SECTIONS.map((s) => s.key) as (typeof SECTION_KEYS)[number][],
    ),
  hidden: z.array(z.enum(SECTION_KEYS)).catch([]),
});

export type ResumeDesign = z.infer<typeof designSchema>;
export type ResumeSectionKey = ResumeDesign["order"][number];

export const resumeContentSchema = profileSchema;

/** Fills in any option a saved design is missing (or has an invalid value for). */
export function normalizeDesign(raw: unknown): ResumeDesign {
  const d = designSchema.parse(raw && typeof raw === "object" ? raw : {});
  // Every section appears once in the order, even ones added after it was saved.
  const order = [
    ...new Set([...d.order, ...RESUME_SECTIONS.map((s) => s.key)]),
  ] as ResumeSectionKey[];
  return { ...d, order };
}

export function defaultDesign(): ResumeDesign {
  return normalizeDesign({});
}

/** Templates are starting points: picking one sets these options, all still editable. */
export const TEMPLATES: {
  id: ResumeDesign["template"];
  label: string;
  note: string;
  preset: Partial<ResumeDesign>;
}[] = [
  {
    id: "professional",
    label: "Professional",
    note: "Centred header, bold rules, dense and ATS-safe",
    preset: {
      font: "open-sans",
      fontSize: 10.5,
      lineHeight: 1.35,
      margin: 14,
      sectionGap: 5,
      headerAlign: "center",
      contactStyle: "icons",
      headingCase: "upper",
      headingRule: "thick",
      datePosition: "right",
      subtitle: "inline",
      accent: "#111827",
      accentOn: ["headings", "rule", "icons"],
    },
  },
  {
    id: "modern",
    label: "Modern",
    note: "Left header, accent headline, light rules",
    preset: {
      font: "inter",
      fontSize: 10,
      lineHeight: 1.42,
      margin: 15,
      sectionGap: 4.5,
      headerAlign: "left",
      contactStyle: "dots",
      headingCase: "upper",
      headingRule: "thin",
      datePosition: "right",
      subtitle: "below",
      dateFormat: "Mon YYYY",
      accent: "#1f2937",
      accentOn: ["headings"],
    },
  },
];

/** Page size in CSS pixels (96 dpi). */
export function pageSize(design: ResumeDesign) {
  return design.pageSize === "Letter"
    ? { w: 816, h: 1056, css: "Letter" }
    : { w: 794, h: 1123, css: "A4" };
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

const MONTHS = [
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
];

/** "2022-03" → "03/2022", "Mar 2022" or "2022"; "2022" and "Present" stay. */
export function formatResumeDate(
  value: string,
  format: ResumeDesign["dateFormat"] = "Mon YYYY",
) {
  const v = value.trim();
  const m = v.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return v;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return v;
  if (format === "YYYY") return m[1];
  if (format === "MM/YYYY") return `${String(month).padStart(2, "0")}/${m[1]}`;
  return `${MONTHS[month - 1]} ${m[1]}`;
}

export function dateRange(
  start: string,
  end: string,
  format: ResumeDesign["dateFormat"] = "Mon YYYY",
) {
  const a = formatResumeDate(start, format);
  const b = formatResumeDate(end, format);
  if (a && b) return `${a} – ${b}`;
  return a || b;
}
