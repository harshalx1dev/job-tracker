import { describe, expect, it } from "vitest";
import {
  actorInput,
  experienceRange,
  filterListings,
  hasTerm,
  normalizeLinkedin,
  normalizeNaukri,
  queryKey,
  tooSoon,
  windowDays,
  toIso,
  type Listing,
  type SearchRequest,
} from "./job-search";

const now = new Date("2026-11-17T10:00:00Z");

const req = (over: Partial<SearchRequest> = {}): SearchRequest => ({
  source: "linkedin",
  keywords: "AEM developer",
  location: "Mumbai, India",
  mustHave: ["AEM", "Adobe Experience Manager"],
  maxAgeDays: 15,
  limit: 20,
  titleExclude: ["lead", "architect"],
  directOnly: true,
  ...over,
});

const listing = (over: Partial<Listing>): Listing => ({
  source: "linkedin",
  externalId: Math.random().toString(),
  title: "AEM Developer",
  company: "Acme",
  location: "Mumbai, Maharashtra, India",
  url: `https://example.com/${Math.random()}`,
  applyUrl: null,
  salary: null,
  experience: null,
  skills: [],
  postedAt: "2026-11-15T00:00:00.000Z",
  applicants: null,
  recruiterPost: false,
  description: "Build AEM components.",
  ...over,
});

describe("what to ask Apify for", () => {
  it("narrows Naukri with skills, freshness, experience and date order", () => {
    const i = actorInput(req({ source: "naukri", experienceYears: 3 }));
    expect(i).toMatchObject({
      skills: ["AEM"],
      experience: "3",
      freshness: 15,
      postedBy: "Company",
      sortBy: "date",
      maxResults: 20,
    });
  });
  it("narrows LinkedIn with a week of postings and title exclusions", () => {
    expect(actorInput(req({ maxAgeDays: 7 }))).toMatchObject({
      datePosted: "r604800",
      titleExclude: ["lead", "architect"],
      limit: 20,
    });
  });
});

describe("reading results", () => {
  it("reads Apify dates and Naukri listings, with skills as text or objects", () => {
    expect(toIso("2026-11-16 13:14:31 UTC")).toBe("2026-11-16T13:14:31.000Z");
    expect(toIso("nonsense")).toBeNull();
    const l = normalizeNaukri({
      jobId: "1",
      title: "AEM Cloud Developer",
      companyName: "Clifyx",
      location: "Mumbai",
      salary: "Not disclosed",
      experienceText: "2-6 Yrs",
      skills: ["AEM", { label: "HTML" }],
      createdDate: "2026-11-16 12:56:24 UTC",
      portalUrl: "https://www.naukri.com/x",
      description: "  a\n\n b  ",
    });
    expect(l).toMatchObject({
      salary: null,
      skills: ["AEM", "HTML"],
      description: "a b",
    });
  });
  it("drops items without a title or link", () => {
    expect(normalizeLinkedin({ title: "x" })).toBeNull();
  });
});

describe("filterListings, one rule per failure seen in the trial", () => {
  it("matches whole words only", () => {
    expect(hasTerm("Senior AEM Developer", "AEM")).toBe(true);
    expect(hasTerm("Aemulus Corp", "AEM")).toBe(false);
  });

  it("drops stale listings", () => {
    const { kept, dropped } = filterListings(
      [listing({ postedAt: "2025-03-10T00:00:00.000Z" }), listing({})],
      req(),
      [],
      now,
    );
    expect(kept).toHaveLength(1);
    expect(dropped.stale).toBe(1);
  });

  it("drops SAP-style noise that never mentions AEM", () => {
    const { kept, dropped } = filterListings(
      [
        listing({
          title: "Application Developer",
          description: "Must have skills: SAP FI S/4HANA",
        }),
        listing({
          title: "Web Developer",
          description: "Adobe Experience Manager pages",
        }),
      ],
      req(),
      [],
      now,
    );
    expect(kept.map((l) => l.title)).toEqual(["Web Developer"]);
    expect(dropped.noMatch).toBe(1);
  });

  it("drops a Bengaluru job from a Mumbai search, but keeps remote ones", () => {
    const { kept, dropped } = filterListings(
      [
        listing({ location: "Bengaluru, Karnataka, India" }),
        listing({
          title: "AEM Developer (Remote)",
          location: "India",
          company: "B",
        }),
      ],
      req(),
      [],
      now,
    );
    expect(kept).toHaveLength(1);
    expect(dropped.wrongPlace).toBe(1);
  });

  it("drops excluded title words and experience ranges that miss her years", () => {
    const { dropped } = filterListings(
      [
        listing({ title: "AEM Lead" }),
        listing({
          source: "naukri",
          company: "C",
          experience: "5-8 Yrs",
        }),
      ],
      req({ experienceYears: 3 }),
      [],
      now,
    );
    expect(dropped.titleExcluded).toBe(1);
    expect(dropped.experience).toBe(1);
  });

  it("drops what is already tracked, by link or by company and title", () => {
    const a = listing({ url: "https://x/1" });
    const b = listing({
      company: "Crisil",
      title: "AEM Developer",
      url: "https://x/2",
    });
    const { kept, dropped } = filterListings(
      [a, b],
      req(),
      [
        { url: "https://x/1", company: "Other", title: "Other" },
        { url: null, company: "CRISIL", title: "aem developer" },
      ],
      now,
    );
    expect(kept).toHaveLength(0);
    expect(dropped.alreadyTracked).toBe(2);
  });

  it("keeps only the newest copy of a repeated job", () => {
    const copies = [1, 2, 3, 4].map((d) =>
      listing({
        company: "Accenture in India",
        title: "Web Developer Associate",
        postedAt: `2026-11-1${d}T00:00:00.000Z`,
      }),
    );
    const { kept, dropped } = filterListings(copies, req(), [], now);
    expect(dropped.duplicate).toBe(3);
    expect(kept).toHaveLength(1);
    expect(kept[0].postedAt).toBe("2026-11-14T00:00:00.000Z");
  });

  it("keeps at most two different jobs from one company", () => {
    const jobs = ["A", "B", "C"].map((t) =>
      listing({ company: "Accenture in India", title: `Web Developer ${t}` }),
    );
    const { kept, dropped } = filterListings(jobs, req(), [], now);
    expect(kept).toHaveLength(2);
    expect(dropped.overCompanyLimit).toBe(1);
  });
});

describe("remembering between searches", () => {
  const last = new Date("2026-11-17T04:00:00Z");

  it("looks back only to the last run, but never past the user's limit", () => {
    expect(windowDays(15, null, now)).toBe(15);
    expect(windowDays(15, last, now)).toBe(1);
    expect(windowDays(15, new Date("2026-11-12T10:00:00Z"), now)).toBe(5);
    expect(windowDays(15, new Date("2026-09-01T00:00:00Z"), now)).toBe(15);
  });

  it("refuses an identical repeat within three hours", () => {
    expect(tooSoon(new Date("2026-11-17T08:30:00Z"), now)).toBe(true);
    expect(tooSoon(last, now)).toBe(false);
    expect(tooSoon(null, now)).toBe(false);
  });

  it("treats the same filters as one search, whatever the word order or case", () => {
    const a = queryKey(req());
    expect(
      queryKey(req({ mustHave: ["adobe experience manager", "AEM"] })),
    ).toBe(a);
    expect(queryKey(req({ keywords: "react developer" }))).not.toBe(a);
    expect(queryKey(req({ source: "naukri" }))).not.toBe(a);
  });

  it("asks each source to skip what it has shown", () => {
    const mem = { skipIds: ["111", "222"], stateKey: "k" };
    expect(actorInput(req(), mem)).toMatchObject({ skipJobId: ["111", "222"] });
    expect(actorInput(req({ source: "naukri" }), mem)).toMatchObject({
      incremental: true,
      stateKey: "k",
    });
    expect(actorInput(req())).not.toHaveProperty("skipJobId");
  });

  it("narrows to a day for a repeat", () => {
    expect(actorInput(req({ maxAgeDays: 1 }))).toMatchObject({
      datePosted: "r86400",
    });
    expect(actorInput(req({ source: "naukri", maxAgeDays: 1 }))).toMatchObject({
      freshness: 1,
    });
  });

  it("drops listings it has already shown", () => {
    const a = listing({ externalId: "A" });
    const b = listing({ externalId: "B", company: "Other" });
    const { kept, dropped } = filterListings(
      [a, b],
      req(),
      [],
      now,
      new Set(["A"]),
    );
    expect(kept.map((l) => l.externalId)).toEqual(["B"]);
    expect(dropped.alreadySeen).toBe(1);
  });
});

describe("experienceRange", () => {
  it("reads ranges and open-ended minimums", () => {
    expect(experienceRange("3-8 Yrs")).toEqual([3, 8]);
    expect(experienceRange("5+ Yrs")).toEqual([5, null]);
    expect(experienceRange("Fresher")).toBeNull();
  });
});
