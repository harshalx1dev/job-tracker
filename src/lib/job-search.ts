import { createHash } from "node:crypto";

/**
 * Job search through Apify, kept pure so it can be tested: what to ask each
 * Actor for, how to read what comes back, and which listings to drop before
 * Claude sees them. The filters come from a trial (Nov 2026): the Actors'
 * own filters are loose (freshness is ignored once Naukri's `skills` is set,
 * keyword search returns every "developer", LinkedIn returns many copies of
 * one company's job), so we cut the results down here.
 */

export const SEARCH_SOURCES = ["naukri", "linkedin"] as const;
export type SearchSource = (typeof SEARCH_SOURCES)[number];

export const ACTORS: Record<SearchSource, string> = {
  naukri: "blackfalcondata~naukri-jobs-feed",
  linkedin: "valig~linkedin-jobs-scraper",
};

export const MAX_LIMIT = 30;
/** The same search is not run again within this many hours: nothing new can be expected. */
export const MIN_GAP_HOURS = 3;
/** Listings already shown are remembered this long. */
export const SEEN_DAYS = 45;
/** Most seen ids sent to LinkedIn's skip list. */
const MAX_SKIP_IDS = 400;
export const DEFAULT_LIMIT = 20;
export const MAX_AGE_DAYS = 30;
export const DEFAULT_AGE_DAYS = 15;
/** Most listings kept from one company per search (some post dozens of copies). */
export const PER_COMPANY = 2;
const DESCRIPTION_CHARS = 2000;

export type SearchRequest = {
  source: SearchSource;
  keywords: string;
  location: string;
  /** A listing is kept only if one of these appears in its title, skills or text. */
  mustHave: string[];
  /** Years of experience: Naukri drops jobs whose range excludes it. */
  experienceYears?: number;
  maxAgeDays: number;
  limit: number;
  /** Words that drop a listing from its title (for example "lead"). */
  titleExclude: string[];
  /** Naukri only: skip recruiters' posts. */
  directOnly: boolean;
};

export type Listing = {
  source: SearchSource;
  externalId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  applyUrl: string | null;
  salary: string | null;
  experience: string | null;
  skills: string[];
  postedAt: string | null;
  applicants: string | null;
  recruiterPost: boolean;
  description: string;
};

/* ─────────────────────────── what to ask for ─────────────────────────── */

const freshness = (days: number) =>
  days <= 1 ? 1 : days <= 3 ? 3 : days <= 7 ? 7 : days <= 15 ? 15 : 30;
const linkedinAge = (days: number) =>
  days <= 1 ? "r86400" : days <= 7 ? "r604800" : "r2592000";

/** What a search remembers between runs. */
export type Memory = { skipIds: string[]; stateKey: string };

/** One search, as the same source with the same filters. Its last run decides what is new. */
export function queryKey(req: SearchRequest): string {
  const parts = [
    req.source,
    norm(req.keywords),
    norm(req.location),
    [...req.mustHave].map(norm).sort().join(","),
    [...req.titleExclude].map(norm).sort().join(","),
    String(req.experienceYears ?? ""),
    String(req.directOnly),
  ];
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

/** Days to look back: since the last run of this search, never more than the user's limit. */
export function windowDays(
  maxAgeDays: number,
  lastRanAt: Date | null,
  now = new Date(),
) {
  if (!lastRanAt) return maxAgeDays;
  const days = Math.ceil((now.getTime() - lastRanAt.getTime()) / 86_400_000);
  return Math.max(1, Math.min(maxAgeDays, days));
}

/** "less than a minute ago", "1 minute ago", "40 minutes ago", "2 hours ago". */
export function agoText(from: Date, now = new Date()) {
  const mins = Math.floor((now.getTime() - from.getTime()) / 60_000);
  if (mins < 1) return "less than a minute ago";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export function tooSoon(lastRanAt: Date | null, now = new Date()) {
  return (
    lastRanAt !== null &&
    now.getTime() - lastRanAt.getTime() < MIN_GAP_HOURS * 3_600_000
  );
}

export function actorInput(
  req: SearchRequest,
  memory?: Memory,
): Record<string, unknown> {
  if (req.source === "naukri") {
    return {
      keyword: req.keywords,
      // The skills filter is what stops "Application Developer" (SAP, Java) noise.
      skills: req.mustHave.slice(0, 1),
      location: req.location,
      ...(req.experienceYears !== undefined
        ? { experience: String(req.experienceYears) }
        : {}),
      freshness: freshness(req.maxAgeDays),
      postedBy: req.directOnly ? "Company" : "Both",
      sortBy: "date",
      maxResults: req.limit,
      fetchDetails: true,
      descriptionMaxLength: DESCRIPTION_CHARS,
      excludeEmptyFields: true,
      // Naukri keeps its own record of what it has returned for this search.
      ...(memory ? { incremental: true, stateKey: memory.stateKey } : {}),
    };
  }
  return {
    keywords: req.keywords,
    location: req.location,
    datePosted: linkedinAge(req.maxAgeDays),
    titleExclude: req.titleExclude,
    limit: req.limit,
    // LinkedIn skips these before returning (and charging for) them.
    ...(memory?.skipIds.length
      ? { skipJobId: memory.skipIds.slice(0, MAX_SKIP_IDS) }
      : {}),
  };
}

/** Only these fields come back from Apify, so a run's payload stays small. */
export const ACTOR_FIELDS: Record<SearchSource, string> = {
  naukri:
    "jobId,title,companyName,location,salary,experienceText,skills,createdDate,portalUrl,description,consultant,companyApplyUrl",
  linkedin:
    "id,title,companyName,location,postedDate,applicationsCount,applyType,applyUrl,url,description,salary,workType",
};

/* ─────────────────────────── what came back ─────────────────────────── */

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const skillName = (s: unknown) =>
  typeof s === "string"
    ? s
    : s && typeof s === "object"
      ? str((s as Raw).label ?? (s as Raw).name ?? (s as Raw).skill ?? "")
      : "";

/** Apify dates look like "2026-11-16 13:14:31 UTC" or ISO. Returns ISO or null. */
export function toIso(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(
    /^\d{4}-\d{2}-\d{2} /.test(s)
      ? s.replace(" ", "T").replace(/ ?UTC$/, "Z")
      : s,
  );
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const clip = (s: string) =>
  s.replace(/\s+/g, " ").trim().slice(0, DESCRIPTION_CHARS);

export function normalizeNaukri(r: Raw): Listing | null {
  const title = str(r.title);
  const url = str(r.portalUrl);
  if (!title || !url) return null;
  return {
    source: "naukri",
    externalId: str(r.jobId) || url,
    title,
    company: str(r.companyName),
    location: str(r.location),
    url,
    applyUrl: str(r.companyApplyUrl) || null,
    salary: /not disclosed/i.test(str(r.salary)) ? null : str(r.salary) || null,
    experience: str(r.experienceText) || null,
    skills: (Array.isArray(r.skills) ? r.skills : [])
      .map(skillName)
      .filter(Boolean),
    postedAt: toIso(r.createdDate),
    applicants: null,
    recruiterPost: r.consultant === true,
    description: clip(str(r.description)),
  };
}

export function normalizeLinkedin(r: Raw): Listing | null {
  const title = str(r.title);
  const url = str(r.url);
  if (!title || !url) return null;
  return {
    source: "linkedin",
    externalId: str(r.id) || url,
    title,
    company: str(r.companyName),
    location: str(r.location),
    url,
    applyUrl: str(r.applyUrl) || null,
    salary: str(r.salary) || null,
    experience: null,
    skills: [],
    postedAt: toIso(r.postedDate),
    applicants: str(r.applicationsCount) || null,
    recruiterPost: false,
    description: clip(str(r.description)),
  };
}

export function normalizeAll(source: SearchSource, items: unknown[]) {
  const fn = source === "naukri" ? normalizeNaukri : normalizeLinkedin;
  return items
    .map((i) => (i && typeof i === "object" ? fn(i as Raw) : null))
    .filter((l): l is Listing => l !== null);
}

/* ─────────────────────────── what to drop ─────────────────────────── */

export type Tracked = { url: string | null; company: string; title: string };

export type Dropped = {
  alreadySeen: number;
  stale: number;
  noMatch: number;
  wrongPlace: number;
  experience: number;
  titleExcluded: number;
  alreadyTracked: number;
  duplicate: number;
  overCompanyLimit: number;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Words are matched whole, so "AEM" does not match "aemulus". */
export function hasTerm(text: string, term: string) {
  const t = norm(term);
  return t !== "" && ` ${norm(text)} `.includes(` ${t} `);
}

/** "3-8 Yrs" -> [3, 8]; "5+ Yrs" -> [5, null]; anything else -> null. */
export function experienceRange(
  text: string | null,
): [number, number | null] | null {
  if (!text) return null;
  const m = text.match(/(\d+)\s*(?:-|to)\s*(\d+)/i);
  if (m) return [Number(m[1]), Number(m[2])];
  const p = text.match(/(\d+)\s*\+/);
  return p ? [Number(p[1]), null] : null;
}

const isRemote = (l: Listing) =>
  /\bremote\b|work from home|wfh/i.test(`${l.location} ${l.title}`);

export function filterListings(
  listings: Listing[],
  req: SearchRequest,
  tracked: Tracked[],
  now = new Date(),
  knownIds: ReadonlySet<string> = new Set(),
): { kept: Listing[]; dropped: Dropped } {
  const dropped: Dropped = {
    alreadySeen: 0,
    stale: 0,
    noMatch: 0,
    wrongPlace: 0,
    experience: 0,
    titleExcluded: 0,
    alreadyTracked: 0,
    duplicate: 0,
    overCompanyLimit: 0,
  };
  const cutoff = now.getTime() - req.maxAgeDays * 86_400_000;
  const trackedUrls = new Set(tracked.map((t) => t.url).filter(Boolean));
  const trackedKeys = new Set(
    tracked.map((t) => `${norm(t.company)}|${norm(t.title)}`),
  );
  const seen = new Set<string>();
  const perCompany = new Map<string, number>();
  const kept: Listing[] = [];

  // Newest first, so the copy we keep of a repeated job is the freshest.
  const ordered = [...listings].sort(
    (a, b) => Date.parse(b.postedAt ?? "") - Date.parse(a.postedAt ?? "") || 0,
  );

  for (const l of ordered) {
    const key = `${norm(l.company)}|${norm(l.title)}`;
    if (knownIds.has(l.externalId)) dropped.alreadySeen++;
    else if (l.postedAt && Date.parse(l.postedAt) < cutoff) dropped.stale++;
    else if (
      !req.mustHave.some((m) =>
        hasTerm(`${l.title} ${l.skills.join(" ")} ${l.description}`, m),
      )
    )
      dropped.noMatch++;
    else if (req.titleExclude.some((w) => hasTerm(l.title, w)))
      dropped.titleExcluded++;
    else if (
      req.location &&
      !isRemote(l) &&
      !hasTerm(l.location, req.location.split(",")[0])
    )
      dropped.wrongPlace++;
    else if (!experienceFits(l, req.experienceYears)) dropped.experience++;
    else if (trackedUrls.has(l.url) || trackedKeys.has(key))
      dropped.alreadyTracked++;
    else if (seen.has(key)) dropped.duplicate++;
    else if ((perCompany.get(norm(l.company)) ?? 0) >= PER_COMPANY)
      dropped.overCompanyLimit++;
    else {
      seen.add(key);
      perCompany.set(
        norm(l.company),
        (perCompany.get(norm(l.company)) ?? 0) + 1,
      );
      kept.push(l);
    }
  }
  return { kept, dropped };
}

function experienceFits(l: Listing, years?: number) {
  if (years === undefined) return true;
  const r = experienceRange(l.experience);
  if (!r) return true;
  return years >= r[0] && (r[1] === null || years <= r[1]);
}
