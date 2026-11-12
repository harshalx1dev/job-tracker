import { describe, expect, it } from "vitest";
import {
  docToHighlights,
  docToLines,
  docToMarkup,
  highlightsToDoc,
  markupToDoc,
} from "./rich-doc";
import { parseRichText } from "./rich-text";

describe("highlights <-> editor document", () => {
  const lines = [
    "## Grasim Colour Consultant – Admin Portal",
    "**Designed workflows** in JavaScript",
    "Improved *dashboard* speed via [paging](https://x.dev/a)",
    "## Birla Opus Website",
    "Built **AEM** components",
  ];

  it("round-trips sub-headings, bullets and formatting unchanged", () => {
    expect(docToHighlights(highlightsToDoc(lines))).toEqual(lines);
  });

  it("builds headings and one bullet list per group", () => {
    const doc = highlightsToDoc(lines);
    expect(doc.content?.map((b) => b.type)).toEqual([
      "heading",
      "bulletList",
      "heading",
      "bulletList",
    ]);
    expect(doc.content?.[1].content).toHaveLength(2);
  });

  it("drops empty lines and gives an empty list one bullet to type into", () => {
    expect(docToHighlights(highlightsToDoc(["", "  ", "kept"]))).toEqual([
      "kept",
    ]);
    const empty = highlightsToDoc([]);
    expect(empty.content?.[0].type).toBe("bulletList");
    expect(docToHighlights(empty)).toEqual([]);
  });

  it("keeps empty lines when asked, so a fresh bullet can become a heading", () => {
    const doc = highlightsToDoc(["one", "", "## "], true);
    expect(docToLines(doc, true)).toEqual(["one", "", "## "]);
  });

  it("keeps literal markup characters literal (stored escaped, same text)", () => {
    const l = ["Grew 2 * 3 [x] times"];
    const stored = docToHighlights(highlightsToDoc(l));
    expect(stored).toEqual(["Grew 2 \\* 3 \\[x\\] times"]);
    expect(parseRichText(stored[0])).toEqual(parseRichText(l[0]));
  });

  it("flattens nested lists and stray paragraphs into lines", () => {
    const text = (t: string) => ({
      type: "paragraph",
      content: [{ type: "text", text: t }],
    });
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                text("one"),
                {
                  type: "bulletList",
                  content: [{ type: "listItem", content: [text("nested")] }],
                },
              ],
            },
          ],
        },
        text("loose"),
      ],
    };
    expect(docToHighlights(doc)).toEqual(["one", "nested", "loose"]);
  });
});

describe("single paragraph <-> editor document", () => {
  it("round-trips formatted text", () => {
    const s = "Builds **fast** sites for [Acme](https://acme.dev) and *more*";
    expect(docToMarkup(markupToDoc(s))).toBe(s);
  });

  it("joins several paragraphs into one line", () => {
    const p = (t: string) => ({
      type: "paragraph",
      content: [{ type: "text", text: t }],
    });
    expect(docToMarkup({ type: "doc", content: [p("one"), p("two")] })).toBe(
      "one two",
    );
  });

  it("handles empty text", () => {
    expect(docToMarkup(markupToDoc(""))).toBe("");
  });
});
