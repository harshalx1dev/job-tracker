/**
 * The places Claude can search for jobs. The user turns each on or off in
 * Preferences; the same list, in this order, is in Claude's playbook.
 */

export const JOB_SOURCES = [
  {
    id: "linkedin",
    label: "LinkedIn jobs",
    on: true,
    hint: "The widest selection and the most recruiters.",
    how: "Search the Jobs tab with your search variants.",
  },
  {
    id: "naukri",
    label: "Naukri",
    on: true,
    hint: "Best for volume, IT services and large Indian employers.",
    how: "Search by keyword and place. Skip listings older than about two months.",
  },
  {
    id: "instahyre",
    label: "Instahyre",
    on: true,
    hint: "Curated matches for about 3+ years of experience. Needs you signed in.",
    how: "Open the opportunities and recommended jobs the site matched to the profile, then search by role. Needs the user signed in.",
  },
  {
    id: "posts",
    label: "LinkedIn hiring posts",
    on: true,
    hint: "Openings that only appear as posts, some with an HR email.",
    how: "Follow Workflow C.",
  },
  {
    id: "cutshort",
    label: "Cutshort",
    on: false,
    hint: "Tech and startup roles, best for 0 to 5 years. Needs you signed in.",
    how: "Use the matched and recommended jobs, then search by role. Needs the user signed in. Do not use its AI interview or recording steps.",
  },
  {
    id: "wellfound",
    label: "Wellfound",
    on: false,
    hint: "Startup roles in India and remote. Needs you signed in.",
    how: "Search by role and location, and the remote filter. Needs the user signed in.",
  },
  {
    id: "hirist",
    label: "Hirist",
    on: false,
    hint: "A tech-only job board.",
    how: "Search by role and location.",
  },
  {
    id: "foundit",
    label: "Foundit",
    on: false,
    hint: "Formerly Monster India. Reasonable reach in IT roles.",
    how: "Search by role and location.",
  },
  {
    id: "indeed",
    label: "Indeed",
    on: false,
    hint: "A broad board, not specific to developers.",
    how: "Search by role and location.",
  },
  {
    id: "careers",
    label: "Company career pages",
    on: false,
    hint: "Direct from employers, fresh, but each company is a separate visit.",
    how: "Find the companies with web search if you have it (for example agencies and consultancies that hire for the target roles), then open their career pages in Chrome.",
  },
] as const;

export type SourceId = (typeof JOB_SOURCES)[number]["id"];

export const SOURCE_IDS = JOB_SOURCES.map((s) => s.id) as [
  SourceId,
  ...SourceId[],
];

export const DEFAULT_SOURCES: SourceId[] = JOB_SOURCES.filter((s) => s.on).map(
  (s) => s.id,
);

/** Plain-text list for Claude's playbook. */
export function sourcesText() {
  return JOB_SOURCES.map(
    (s, i) => `${i + 1}. ${s.label} (${s.id}): ${s.how}`,
  ).join("\n");
}
