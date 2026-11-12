"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/server/db";
import { mcpTokens } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import type { ActionResult } from "@/server/jobs/actions";
import {
  MAX_ACTIVE_TOKENS,
  createTokenSchema,
  expiryDate,
  generateToken,
  tokenState,
  type CreateTokenInput,
} from "@/lib/mcp-token";
import { listMcpTokens } from "./tokens";

/** Creates a token. The token itself is returned once and never stored. */
export async function createMcpToken(
  input: CreateTokenInput,
): Promise<ActionResult<{ token: string }>> {
  const user = await requireUser();
  const parsed = createTokenSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form",
    };

  const active = (await listMcpTokens(user.id)).filter(
    (t) => tokenState(t) === "active",
  );
  if (active.length >= MAX_ACTIVE_TOKENS)
    return {
      ok: false,
      error: `You can have ${MAX_ACTIVE_TOKENS} active tokens. Revoke one first.`,
    };

  const { token, prefix, hash } = generateToken();
  await db.insert(mcpTokens).values({
    userId: user.id,
    name: parsed.data.name,
    tokenHash: hash,
    prefix,
    scopes: parsed.data.write ? ["read", "write"] : ["read"],
    expiresAt: expiryDate(parsed.data.expiresInDays),
  });
  refresh();
  return { ok: true, data: { token } };
}

/** Revokes a token: it stops working immediately and stays in the list as revoked. */
export async function revokeMcpToken(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const res = await db
    .update(mcpTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(mcpTokens.id, id),
        eq(mcpTokens.userId, user.id),
        isNull(mcpTokens.revokedAt),
      ),
    )
    .returning({ id: mcpTokens.id });
  if (!res.length) return { ok: false, error: "Token not found" };
  refresh();
  return { ok: true, data: undefined };
}
