import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { lastFour, loadKey, open, seal } from "./crypto";

const key = randomBytes(32);

describe("API key encryption", () => {
  it("round-trips a key", () => {
    const sealed = seal("AIzaSyExample-key_1234", key);
    expect(sealed.ciphertext).not.toContain("AIza");
    expect(open(sealed, key)).toBe("AIzaSyExample-key_1234");
  });

  it("uses a fresh IV each time", () => {
    const a = seal("same", key);
    const b = seal("same", key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("rejects tampered ciphertext", () => {
    const sealed = seal("secret", key);
    const bytes = Buffer.from(sealed.ciphertext, "base64");
    bytes[0] ^= 0xff;
    expect(() =>
      open({ ...sealed, ciphertext: bytes.toString("base64") }, key),
    ).toThrow();
  });

  it("rejects the wrong key", () => {
    expect(() => open(seal("secret", key), randomBytes(32))).toThrow();
  });

  it("requires a 32-byte base64 key", () => {
    expect(() => loadKey(undefined)).toThrow(/not set/);
    expect(() => loadKey(Buffer.alloc(16).toString("base64"))).toThrow(
      /32 bytes/,
    );
    expect(loadKey(key.toString("base64"))).toHaveLength(32);
  });

  it("shows only the last four characters", () => {
    expect(lastFour("  AIzaSyABCD1234 ")).toBe("1234");
  });
});
