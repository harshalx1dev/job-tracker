import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { jobs } from "@/server/db/schema";
import {
  ACTORS,
  ACTOR_FIELDS,
  DEFAULT_AGE_DAYS,
  DEFAULT_LIMIT,
  MAX_AGE_DAYS,
  MAX_LIMIT,
  SEARCH_SOURCES,
  actorInput,
  filterListings,
  normalizeAll,
  queryKey,
  tooSoon,
  windowDays,
  type SearchRequest,
} from "@/lib/job-search";
import { ToolError } from "@/server/mcp/tool";
import { ApifyError, getItems, getRun, startRun } from "./apify";
import { SEARCHES_PER_DAY, getApifyToken, searchesToday } from "./credentials";
import { lastRun, remember, seenIds } from "./memory";

/** Never more than this on one search, whatever the Actor's price. A 30-job search costs about a cent. */
const MAX_CHARGE_USD = 0.05;
const RUN_TIMEOUT_SECS = 120;
/** Seconds to wait for a run before telling Claude to come back for it. */
const WAIT_SECS = 40;

/** The filters, as Claude sends them. They come from the user's profile and preferences. */
export const searchShape = {
  source: z.enum(SEARCH_SOURCES).describe("naukri or linkedin"),
  keywords: z
    .string()
    .min(2)
    .max(100)
    .describe("Role words, for example: AEM developer"),
  location: z.string().min(2).max(60).describe("One city, for example: Mumbai"),
  mustHave: z
    .array(z.string().min(2).max(40))
    .min(1)
    .max(6)
    .describe(
      "Terms a listing must contain in its title, skills or text, for example AEM and Adobe Experience Manager. Not generic words like developer",
    ),
  experienceYears: z
    .number()
    .int()
    .min(0)
    .max(40)
    .optional()
    .describe("The user's years of experience, from the profile"),
  maxAgeDays: z
    .number()
    .int()
    .min(1)
    .max(MAX_AGE_DAYS)
    .default(DEFAULT_AGE_DAYS)
    .describe("Only listings posted in the last N days"),
  limit: z
    .number()
    .int()
    .min(5)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe("How many listings to ask the source for"),
  titleExclude: z
    .array(z.string().min(2).max(30))
    .max(10)
    .default([])
    .describe("Words that rule out a listing by its title, for example lead"),
  directOnly: z
    .boolean()
    .default(true)
    .describe("Naukri only: skip posts by recruiters and consultancies"),
};

export const resultShape = {
  ...searchShape,
  runId: z.string().min(5).max(60).describe("The runId search_jobs returned"),
};

type SearchArgs = z.infer<z.ZodObject<typeof searchShape>>;

const toRequest = (a: SearchArgs): SearchRequest => ({
  source: a.source,
  keywords: a.keywords,
  location: a.location,
  mustHave: a.mustHave,
  experienceYears: a.experienceYears,
  maxAgeDays: a.maxAgeDays,
  limit: a.limit,
  titleExclude: a.titleExclude,
  directOnly: a.directOnly,
});

async function tokenFor(userId: string) {
  const token = await getApifyToken(userId);
  if (!token)
    throw new ToolError(
      "Job search through Apify is not set up. The user can add an Apify API token in Trackr under Settings. Search in the browser instead, and never ask for the token in chat.",
    );
  return token;
}

const guard = async <T>(run: () => Promise<T>) => {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ApifyError) throw new ToolError(err.message);
    throw err;
  }
};

/**
 * Starts a search. Looks back only to the last time this same search ran, skips
 * listings it has already shown, and refuses an identical repeat within a few
 * hours: nothing new can be expected, and every run costs credit.
 */
export async function startSearch(userId: string, args: SearchArgs) {
  const token = await tokenFor(userId);
  const used = await searchesToday(userId);
  if (used >= SEARCHES_PER_DAY)
    throw new ToolError(
      `That is the daily limit of ${SEARCHES_PER_DAY} searches. Use the browser for the rest, or try again tomorrow.`,
    );
  const { req, key, last } = await plan(userId, args);
  if (tooSoon(last))
    throw new ToolError(
      `This exact search finished ${Math.max(1, Math.round((Date.now() - last!.getTime()) / 60_000))} minutes ago, so nothing new is expected yet. Change the keywords or place, or wait a few hours.`,
    );
  const skipIds = await seenIds(userId, req.source);
  const run = await guard(() =>
    startRun(
      token,
      ACTORS[req.source],
      actorInput(req, { skipIds, stateKey: key }),
      {
        maxItems: req.limit,
        maxChargeUsd: MAX_CHARGE_USD,
        timeoutSecs: RUN_TIMEOUT_SECS,
        waitSecs: WAIT_SECS,
      },
    ),
  );
  return collect(userId, token, req, key, last, run);
}

/** Collects the results of a search that was still running. Does not start a new run. */
export async function searchResults(
  userId: string,
  args: SearchArgs & { runId: string },
) {
  const token = await tokenFor(userId);
  const { req, key, last } = await plan(userId, args);
  const run = await guard(() => getRun(token, args.runId, WAIT_SECS));
  return collect(userId, token, req, key, last, run);
}

/** The request to send: the user's filters, narrowed to what is newer than this search's last run. */
async function plan(userId: string, args: SearchArgs) {
  const base = toRequest(args);
  const key = queryKey(base);
  const last = await lastRun(userId, base.source, key);
  return {
    key,
    last,
    req: { ...base, maxAgeDays: windowDays(base.maxAgeDays, last) },
  };
}

async function collect(
  userId: string,
  token: string,
  req: SearchRequest,
  key: string,
  last: Date | null,
  run: {
    id: string;
    status: string;
    datasetId: string;
    costUsd: number | null;
  },
) {
  if (run.status === "READY" || run.status === "RUNNING")
    return {
      status: "running" as const,
      runId: run.id,
      next: "Not finished yet. Call get_search_results with the same filters and this runId in about 20 seconds.",
    };
  if (run.status !== "SUCCEEDED")
    throw new ToolError(
      `The search did not finish (Apify says ${run.status}). Try the browser for this source.`,
    );

  const items = await guard(() =>
    getItems(token, run.datasetId, ACTOR_FIELDS[req.source], MAX_LIMIT * 2),
  );
  const tracked = await db
    .select({ url: jobs.url, company: jobs.company, title: jobs.title })
    .from(jobs)
    .where(eq(jobs.userId, userId));
  const listings = normalizeAll(req.source, items);
  const known = new Set(await seenIds(userId, req.source));
  const { kept, dropped } = filterListings(
    listings,
    req,
    tracked,
    new Date(),
    known,
  );
  // Everything fetched counts as seen, kept or not: it is not fetched or shown again.
  await remember(
    userId,
    req.source,
    key,
    listings.map((l) => l.externalId),
  );
  return {
    status: "done" as const,
    runId: run.id,
    costUsd: run.costUsd,
    lookedBackDays: req.maxAgeDays,
    sinceLastSearch: last ? last.toISOString() : null,
    fetched: items.length,
    returned: kept.length,
    dropped,
    listings: kept,
    next: "Score each listing as in the playbook and add the good ones with create_job (source Naukri or LinkedIn). Listings shown here are remembered and will not come back, so decide on them now. If few were returned, look at dropped to see which filter cut the most.",
  };
}
