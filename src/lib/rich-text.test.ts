import { describe, expect, it } from "vitest";
import { parseRichText, stripRichText } from "./rich-text";

describe("parseRichText", () => {
  it("returns plain text as one token", () => {
    expect(parseRichText("hello world")).toEqual([{ text: "hello world" }]);
  });

  it("parses bold and italic", () => {
    expect(parseRichText("a **b** *c* d")).toEqual([
      { text: "a " },
      { text: "b", bold: true },
      { text: " " },
      { text: "c", italic: true },
      { text: " d" },
    ]);
  });

  it("parses http links, including formatted labels", () => {
    expect(parseRichText("see [**docs**](https://x.dev/a)")).toEqual([
      { text: "see " },
      { text: "docs", bold: true, href: "https://x.dev/a" },
    ]);
  });

  it("drops unsafe link targets but keeps the label text", () => {
    const tokens = parseRichText("[click](javascript:alert(1))");
    expect(tokens.every((t) => !t.href)).toBe(true);
    expect(tokens.map((t) => t.text).join("")).toContain("click");
  });

  it("allows mailto links", () => {
    expect(parseRichText("[me](mailto:a@b.co)")).toEqual([
      { text: "me", href: "mailto:a@b.co" },
    ]);
  });

  it("leaves unmatched markers as text", () => {
    expect(stripRichText("5 * 3 and **open")).toBe("5 * 3 and **open");
  });

  it("never emits html", () => {
    expect(parseRichText("<b>x</b>")).toEqual([{ text: "<b>x</b>" }]);
  });
});
