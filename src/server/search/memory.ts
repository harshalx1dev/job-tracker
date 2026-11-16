import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { searchRuns, seenListings } from "@/server/db/schema";
import { SEEN_DAYS } from "@/lib/job-search";

/** What searches remember, so a repeat asks only for what is new and never shows a listing twice. */

export async function lastRun(
  userId: string,
  source: string,
  queryKey: string,
): Promise<Date | null> {
  const [row] = await db
    .select({ ranAt: searchRuns.ranAt })
    .from(searchRuns)
    .where(
      and(
        eq(searchRuns.userId, userId),
        eq(searchRuns.source, source),
        eq(searchRuns.queryKey, queryKey),
      ),
    );
  return row?.ranAt ?? null;
}

export async function seenIds(
  userId: string,
  source: string,
): Promise<string[]> {
  const since = new Date(Date.now() - SEEN_DAYS * 86_400_000);
  const rows = await db
    .select({ id: seenListings.externalId })
    .from(seenListings)
    .where(
      and(
        eq(seenListings.userId, userId),
        eq(seenListings.source, source),
        gte(seenListings.seenAt, since),
      ),
    )
    .limit(2000);
  return rows.map((r) => r.id);
}

/** Notes that this search finished and that these listings have now been shown. */
export async function remember(
  userId: string,
  source: string,
  queryKey: string,
  externalIds: string[],
) {
  const now = new Date();
  await db
    .insert(searchRuns)
    .values({ userId, source, queryKey, ranAt: now })
    .onConflictDoUpdate({
      target: [searchRuns.userId, searchRuns.source, searchRuns.queryKey],
      set: { ranAt: now },
    });
  if (externalIds.length)
    await db
      .insert(seenListings)
      .values(
        [...new Set(externalIds)].map((externalId) => ({
          userId,
          source,
          externalId,
          seenAt: now,
        })),
      )
      .onConflictDoNothing();
  await db
    .delete(seenListings)
    .where(
      and(
        eq(seenListings.userId, userId),
        lt(seenListings.seenAt, new Date(Date.now() - SEEN_DAYS * 86_400_000)),
      ),
    );
}
