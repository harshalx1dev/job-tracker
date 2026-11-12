import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/**
 * Personal access tokens for the Claude connector (/api/mcp). Pure rules, no
 * database: the token format, how it is hashed, reading it from a request,
 * scopes and expiry. Only the SHA-256 hash is ever stored; the token is 256
 * random bits, so a fast hash is enough (there is nothing to brute-force).
 */

export type McpScope = "read" | "write";

export const TOKEN_PREFIX = "trk_";
/** "trk_" plus 32 random bytes as base64url (43 characters). */
const TOKEN_RE = /^trk_[A-Za-z0-9_-]{43}$/;

export const MAX_ACTIVE_TOKENS = 5;
export const RATE_LIMIT_PER_MINUTE = 60;

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function generateToken() {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  // Enough of the start to tell tokens apart in a list; reveals nothing usable.
  return { token, prefix: token.slice(0, 8), hash: hashToken(token) };
}

/** The token from an `Authorization: Bearer …` header, or null if absent or malformed. */
export function parseBearer(header: string | null | undefined) {
  const m = /^Bearer\s+(\S+)$/i.exec((header ?? "").trim());
  return m && TOKEN_RE.test(m[1]) ? m[1] : null;
}

export const hasScope = (scopes: string[], need: McpScope) =>
  scopes.includes(need);

export type TokenRow = {
  revokedAt: Date | null;
  expiresAt: Date | null;
};

export function tokenState(row: TokenRow, now = new Date()) {
  if (row.revokedAt) return "revoked" as const;
  if (row.expiresAt && row.expiresAt <= now) return "expired" as const;
  return "active" as const;
}

export const EXPIRY_CHOICES = [30, 90, 365, 0] as const; // days; 0 = never
export const DEFAULT_EXPIRY_DAYS = 90;

export const createTokenSchema = z.object({
  name: z.string().trim().min(1, "Give the token a name").max(60),
  /** Also allow tools that add data. Without it the token is read-only. */
  write: z.boolean().default(false),
  expiresInDays: z
    .number()
    .refine((d) => (EXPIRY_CHOICES as readonly number[]).includes(d), {
      message: "Pick one of the lifetimes",
    })
    .default(DEFAULT_EXPIRY_DAYS),
});

export type CreateTokenInput = z.input<typeof createTokenSchema>;

export function expiryDate(days: number, now = new Date()) {
  return days > 0 ? new Date(now.getTime() + days * 86_400_000) : null;
}
