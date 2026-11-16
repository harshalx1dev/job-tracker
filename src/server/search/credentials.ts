import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/server/db";
import { apifyCredentials, mcpCalls, mcpTokens } from "@/server/db/schema";
import { open } from "@/server/ai/crypto";

/** Searches a user may start in 24 hours: each one spends a little of their own Apify credit. */
export const SEARCHES_PER_DAY = 10;

export async function getApifyToken(userId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(apifyCredentials)
    .where(eq(apifyCredentials.userId, userId));
  return row ? open(row) : null;
}

export async function searchesToday(userId: string): Promise<number> {
  const since = new Date(Date.now() - 86_400_000);
  const [row] = await db
    .select({ n: count() })
    .from(mcpCalls)
    .innerJoin(mcpTokens, eq(mcpTokens.id, mcpCalls.tokenId))
    .where(
      and(
        eq(mcpTokens.userId, userId),
        eq(mcpCalls.tool, "search_jobs"),
        eq(mcpCalls.ok, true),
        gte(mcpCalls.createdAt, since),
      ),
    );
  return row?.n ?? 0;
}

export type ApifyStatus =
  | { connected: false }
  | {
      connected: true;
      last4: string;
      username: string;
      validatedAt: Date | null;
      usedToday: number;
      limit: number;
    };

/** What the Settings page may show: never the token itself. */
export async function getApifyStatus(userId: string): Promise<ApifyStatus> {
  const [row] = await db
    .select({
      last4: apifyCredentials.last4,
      username: apifyCredentials.username,
      validatedAt: apifyCredentials.validatedAt,
    })
    .from(apifyCredentials)
    .where(eq(apifyCredentials.userId, userId));
  if (!row) return { connected: false };
  return {
    connected: true,
    ...row,
    usedToday: await searchesToday(userId),
    limit: SEARCHES_PER_DAY,
  };
}
