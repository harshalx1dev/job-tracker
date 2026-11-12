import { describe, expect, it } from "vitest";
import { parseRichText } from "./rich-text";
import {
  fontStyle,
  htmlToMarked,
  markPdfText,
  type StyledItem,
} from "./resume-format";

const item = (str: string, style: Partial<StyledItem> = {}): StyledItem => ({
  str,
  bold: false,
  italic: false,
  ...style,
});

describe("fontStyle", () => {
  it("reads bold and italic from font names", () => {
    expect(fontStyle("AAAAAA+SourceSansPro-Bold")).toEqual({
      bold: true,
      italic: false,
    });
    expect(fontStyle("Arial,BoldItalic")).toEqual({ bold: true, italic: true });
    expect(fontStyle("BAAAAA+SourceSansPro-Regular")).toEqual({
      bold: false,
      italic: false,
    });
  });
});

describe("markPdfText", () => {
  it("wraps a bold lead-in and keeps the rest plain", () => {
    const text = markPdfText([
      item("Designed workflows", { bold: true }),
      item(" in JavaScript", { eol: true }),
    ]);
    expect(text).toBe("**Designed workflows** in JavaScript\n");
  });

  it("keeps spaces outside the markers and joins words in one bold run", () => {
    const text = markPdfText([
      item("Improved ", { bold: true }),
      item("dashboard ", { bold: true }),
      item("performance ", { bold: true }),
      item("via paging", { eol: true }),
    ]);
    expect(text).toBe("**Improved dashboard performance** via paging\n");
  });

  it("never lets a run cross a line, and supports italic and bold italic", () => {
    const text = markPdfText([
      item("Title,", { bold: true, eol: true }),
      item("Agency", { italic: true, eol: true }),
      item("Both", { bold: true, italic: true, eol: true }),
    ]);
    expect(text).toBe("**Title,**\n*Agency*\n***Both***\n");
    expect(parseRichText("***Both***")).toEqual([
      { text: "Both", bold: true, italic: true },
    ]);
  });
});

describe("htmlToMarked", () => {
  it("turns paragraphs, bullets and emphasis into lines with markers", () => {
    const html =
      "<h1>SKILLS</h1><p><strong>Languages:</strong> JS &amp; TS</p><ul><li><strong>Built</strong> a <em>thing</em></li></ul>";
    expect(htmlToMarked(html)).toBe(
      "SKILLS\n**Languages:** JS & TS\n**Built** a *thing*",
    );
  });

  it("merges neighbouring bold runs", () => {
    expect(htmlToMarked("<p><strong>a</strong> <strong>b</strong></p>")).toBe(
      "**a b**",
    );
  });
});
