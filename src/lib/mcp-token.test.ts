import { describe, expect, it } from "vitest";
import {
  createTokenSchema,
  expiryDate,
  generateToken,
  hasScope,
  hashToken,
  parseBearer,
  tokenState,
} from "./mcp-token";

describe("generateToken", () => {
  it("makes a long random token with a matching hash and a short display prefix", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.token).toMatch(/^trk_[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.prefix).toBe(a.token.slice(0, 8));
    expect(a.hash).not.toContain(a.token);
  });
});

describe("parseBearer", () => {
  const { token } = generateToken();

  it("reads a well-formed Bearer token, any case of the scheme", () => {
    expect(parseBearer(`Bearer ${token}`)).toBe(token);
    expect(parseBearer(`bearer   ${token} `)).toBe(token);
  });

  it("rejects missing, malformed and wrong-shaped values", () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("")).toBeNull();
    expect(parseBearer(token)).toBeNull(); // no scheme
    expect(parseBearer(`Basic ${token}`)).toBeNull();
    expect(parseBearer("Bearer trk_short")).toBeNull();
    expect(parseBearer(`Bearer ${token}x`)).toBeNull();
    expect(parseBearer(`Bearer ${token.replace("trk_", "abc_")}`)).toBeNull();
    expect(parseBearer(`Bearer ${token} extra`)).toBeNull();
  });
});

describe("tokenState", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("is active until it expires or is revoked", () => {
    expect(tokenState({ revokedAt: null, expiresAt: null }, now)).toBe(
      "active",
    );
    expect(
      tokenState({ revokedAt: null, expiresAt: new Date("2026-06-01") }, now),
    ).toBe("active");
    expect(
      tokenState({ revokedAt: null, expiresAt: new Date("2025-12-31") }, now),
    ).toBe("expired");
    expect(
      tokenState(
        { revokedAt: null, expiresAt: new Date("2026-01-01T00:00:00Z") },
        now,
      ),
    ).toBe("expired");
    expect(
      tokenState({ revokedAt: new Date("2025-12-01"), expiresAt: null }, now),
    ).toBe("revoked");
  });

  it("treats revoked as stronger than expired", () => {
    expect(
      tokenState(
        {
          revokedAt: new Date("2025-01-01"),
          expiresAt: new Date("2025-02-01"),
        },
        now,
      ),
    ).toBe("revoked");
  });
});

describe("scopes and expiry", () => {
  it("checks scopes by name", () => {
    expect(hasScope(["read"], "read")).toBe(true);
    expect(hasScope(["read"], "write")).toBe(false);
    expect(hasScope(["read", "write"], "write")).toBe(true);
  });

  it("computes the expiry date, or none for 'never'", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(expiryDate(90, now)?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(expiryDate(0, now)).toBeNull();
  });
});

describe("createTokenSchema", () => {
  it("defaults to read-only and 90 days", () => {
    expect(createTokenSchema.parse({ name: " Claude " })).toEqual({
      name: "Claude",
      write: false,
      expiresInDays: 90,
    });
  });

  it("needs a name and one of the offered lifetimes", () => {
    expect(createTokenSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(
      createTokenSchema.safeParse({ name: "x", expiresInDays: 7 }).success,
    ).toBe(false);
    for (const d of [30, 90, 365, 0])
      expect(
        createTokenSchema.safeParse({ name: "x", expiresInDays: d }).success,
      ).toBe(true);
  });
});
