import "server-only";
import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { mcpCalls, mcpTokens, user } from "@/server/db/schema";
import type { CurrentUser } from "@/server/session";
import {
  RATE_LIMIT_PER_MINUTE,
  hashToken,
  parseBearer,
  tokenState,
} from "@/lib/mcp-token";

export type McpAuth = {
  tokenId: string;
  scopes: string[];
  /** The token's owner. Every tool call is scoped to this user, never to input. */
  user: CurrentUser;
};

export type McpAuthResult =
  | { ok: true; auth: McpAuth }
  // Callers answer all failures the same way (401); the reason is for logs only.
  | { ok: false; reason: "missing" | "unknown" | "revoked" | "expired" };

const KEEP_CALLS_DAYS = 30;

/** Resolves an `Authorization: Bearer trk_…` header to the token's owner. */
export async function authenticateBearer(
  header: string | null,
): Promise<McpAuthResult> {
  const token = parseBearer(header);
  if (!token) return { ok: false, reason: "missing" };

  const [row] = await db
    .select({
      id: mcpTokens.id,
      scopes: mcpTokens.scopes,
      expiresAt: mcpTokens.expiresAt,
      revokedAt: mcpTokens.revokedAt,
      lastUsedAt: mcpTokens.lastUsedAt,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
    })
    .from(mcpTokens)
    .innerJoin(user, eq(user.id, mcpTokens.userId))
    // The hash column is unique, so this finds at most one token.
    .where(eq(mcpTokens.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return { ok: false, reason: "unknown" };

  const state = tokenState(row);
  if (state !== "active") return { ok: false, reason: state };

  // "Last used" to the minute is plenty; don't write on every call.
  const now = new Date();
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > 60_000)
    await db
      .update(mcpTokens)
      .set({ lastUsedAt: now })
      .where(eq(mcpTokens.id, row.id));

  return {
    ok: true,
    auth: {
      tokenId: row.id,
      scopes: row.scopes,
      user: {
        id: row.userId,
        name: row.name,
        email: row.email,
        image: row.image ?? null,
        role: row.role === "admin" ? "admin" : "user",
      },
    },
  };
}

/** Calls in the last minute, counted from the log so the limit holds across serverless instances. */
export async function isRateLimited(tokenId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(mcpCalls)
    .where(
      and(
        eq(mcpCalls.tokenId, tokenId),
        gte(mcpCalls.createdAt, new Date(Date.now() - 60_000)),
      ),
    );
  return n >= RATE_LIMIT_PER_MINUTE;
}

export async function logCall(tokenId: string, tool: string, ok: boolean) {
  try {
    await db.insert(mcpCalls).values({ tokenId, tool, ok });
    // Keep a month of history; tidy up now and then rather than on every call.
    if (Math.random() < 0.02)
      await db
        .delete(mcpCalls)
        .where(
          lt(
            mcpCalls.createdAt,
            new Date(Date.now() - KEEP_CALLS_DAYS * 86_400_000),
          ),
        );
  } catch {
    // Logging must never break a tool call.
  }
}

export type PublicToken = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

/**
 * For the Settings page: null when the table can't be read (the database
 * hasn't been migrated yet), so the page hides the connector card instead of failing.
 */
export async function getMcpTokensSafe(
  userId: string,
): Promise<PublicToken[] | null> {
  try {
    return await listMcpTokens(userId);
  } catch (err) {
    console.error("mcp_tokens unavailable (run npm run db:migrate)", err);
    return null;
  }
}

export async function listMcpTokens(userId: string): Promise<PublicToken[]> {
  return db
    .select({
      id: mcpTokens.id,
      name: mcpTokens.name,
      prefix: mcpTokens.prefix,
      scopes: mcpTokens.scopes,
      expiresAt: mcpTokens.expiresAt,
      lastUsedAt: mcpTokens.lastUsedAt,
      revokedAt: mcpTokens.revokedAt,
      createdAt: mcpTokens.createdAt,
    })
    .from(mcpTokens)
    .where(eq(mcpTokens.userId, userId))
    .orderBy(desc(mcpTokens.createdAt));
}
