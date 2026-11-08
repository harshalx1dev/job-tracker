import { describe, expect, it } from "vitest";
import { createPrintToken, verifyPrintToken } from "./print-token";

const KEY = "test-secret";
const NOW = 1_800_000_000_000;

describe("print tokens", () => {
  it("verifies a fresh token for the same resume", () => {
    const t = createPrintToken("r1", NOW, KEY);
    expect(verifyPrintToken("r1", t, NOW + 1000, KEY)).toBe(true);
  });

  it("rejects another resume's token", () => {
    expect(
      verifyPrintToken("r2", createPrintToken("r1", NOW, KEY), NOW, KEY),
    ).toBe(false);
  });

  it("expires after two minutes", () => {
    const t = createPrintToken("r1", NOW, KEY);
    expect(verifyPrintToken("r1", t, NOW + 2 * 60_000 + 1, KEY)).toBe(false);
  });

  it("rejects tampered or missing tokens", () => {
    const [exp, sig] = createPrintToken("r1", NOW, KEY).split(".");
    expect(
      verifyPrintToken("r1", `${Number(exp) + 60_000}.${sig}`, NOW, KEY),
    ).toBe(false);
    expect(verifyPrintToken("r1", undefined, NOW, KEY)).toBe(false);
    expect(verifyPrintToken("r1", "garbage", NOW, KEY)).toBe(false);
    expect(
      verifyPrintToken("r1", createPrintToken("r1", NOW, "other"), NOW, KEY),
    ).toBe(false);
  });
});
