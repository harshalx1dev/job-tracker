import type { Profile } from "@/lib/profile";

/**
 * The wording changes the Claude connector may make to a resume copy. Only
 * text can change: the summary, an experience role's highlights, a project's
 * description and highlights. Companies, titles, dates, locations and links
 * are never touched, so a rewrite can't invent or alter a fact about the person.
 */

export type WordingPatch = {
  summary?: string;
  experience?: { company: string; title?: string; highlights: string[] }[];
  projects?: { name: string; description?: string; highlights?: string[] }[];
};

/** A problem with the patch that is worth telling the caller about. */
export class WordingError extends Error {}

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** Returns a changed copy; the input profile is never modified. */
export function applyWording(content: Profile, patch: WordingPatch): Profile {
  const next = structuredClone(content);
  if (patch.summary !== undefined) next.summary = patch.summary;

  for (const p of patch.experience ?? []) {
    const hits = next.experience.filter(
      (e) => same(e.company, p.company) && (!p.title || same(e.title, p.title)),
    );
    if (hits.length === 0)
      throw new WordingError(
        `No role at "${p.company}"${p.title ? ` titled "${p.title}"` : ""}. Roles: ${
          next.experience.map((e) => `${e.company} (${e.title})`).join("; ") ||
          "none"
        }.`,
      );
    if (hits.length > 1)
      throw new WordingError(
        `More than one role at "${p.company}": pass the title as well.`,
      );
    hits[0].highlights = p.highlights;
  }

  for (const p of patch.projects ?? []) {
    const hit = next.projects.find((x) => same(x.name, p.name));
    if (!hit)
      throw new WordingError(
        `No project named "${p.name}". Projects: ${
          next.projects.map((x) => x.name).join("; ") || "none"
        }.`,
      );
    if (p.description !== undefined) hit.description = p.description;
    if (p.highlights !== undefined) hit.highlights = p.highlights;
  }
  return next;
}
