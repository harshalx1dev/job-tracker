import { describe, expect, it } from "vitest";
import {
  applyLink,
  headingText,
  isHeadingLine,
  parseRichText,
  stripRichText,
  toggleHeading,
  toggleMarker,
} from "./rich-text";

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

describe("editing helpers", () => {
  it("wraps the selection in bold and unwraps it again", () => {
    const on = toggleMarker("make this loud", 5, 9, "**");
    expect(on).toEqual({ value: "make **this** loud", start: 7, end: 11 });
    const off = toggleMarker(on.value, on.start, on.end, "**");
    expect(off).toEqual({ value: "make this loud", start: 5, end: 9 });
  });

  it("puts the caret between the markers when nothing is selected", () => {
    expect(toggleMarker("ab", 1, 1, "*")).toEqual({
      value: "a**b",
      start: 2,
      end: 2,
    });
  });

  it("does not read one star of **bold** as italics", () => {
    const r = toggleMarker("**bold**", 2, 6, "*");
    expect(r.value).toBe("***bold***");
  });

  it("makes links from the selection, adds https:// to bare domains, rejects junk", () => {
    expect(applyLink("see docs", 4, 8, "x.dev/a")).toEqual({
      value: "see [docs](https://x.dev/a)",
      start: 4,
      end: 27,
    });
    expect(applyLink("x", 0, 1, "javascript:alert(1)")).toBeNull();
    expect(applyLink("", 0, 0, "https://x.dev")?.value).toBe(
      "[https://x.dev](https://x.dev)",
    );
  });

  it("toggles a sub-heading prefix on the caret's line", () => {
    const on = toggleHeading("one\ntwo", 5);
    expect(on.value).toBe("one\n## two");
    expect(toggleHeading(on.value, on.start).value).toBe("one\ntwo");
  });

  it("recognises heading lines", () => {
    expect(isHeadingLine("## Birla Opus")).toBe(true);
    expect(isHeadingLine("Built ## things")).toBe(false);
    expect(headingText("##  Birla Opus ")).toBe("Birla Opus");
  });
});
