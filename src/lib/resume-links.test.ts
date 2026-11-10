import { describe, expect, it } from "vitest";
import {
  cleanLinks,
  linksBlock,
  linksFromHtml,
  textInRect,
  type PdfTextItem,
} from "./resume-links";

const item = (str: string, x: number, y: number, width = 40): PdfTextItem => ({
  str,
  transform: [1, 0, 0, 1, x, y],
  width,
  height: 10,
});

describe("textInRect", () => {
  it("returns only the words under the link's rectangle", () => {
    const items = [
      item("LinkedIn", 100, 700),
      item("|", 145, 700, 4),
      item("GitHub", 155, 700),
      item("Jane Doe", 100, 740, 80),
    ];
    expect(textInRect(items, [98, 698, 142, 712])).toBe("LinkedIn");
    expect(textInRect(items, [153, 712, 197, 698])).toBe("GitHub");
  });
});

describe("linksFromHtml", () => {
  it("reads Word hyperlinks with their visible text", () => {
    const html =
      '<p><a href="https://www.linkedin.com/in/jane">Linked<strong>In</strong></a> | <a href="#_top">top</a> | <a href="https://github.com/jane?a=1&amp;b=2">GitHub</a></p>';
    expect(linksFromHtml(html)).toEqual([
      { url: "https://www.linkedin.com/in/jane", text: "LinkedIn" },
      { url: "https://github.com/jane?a=1&b=2", text: "GitHub" },
    ]);
  });
});

describe("cleanLinks / linksBlock", () => {
  it("keeps web, mail and phone links once, and lists them for the parser", () => {
    const links = cleanLinks([
      { text: "LinkedIn", url: "https://linkedin.com/in/jane/" },
      { text: "LinkedIn", url: "https://linkedin.com/in/jane" },
      { text: "Email", url: "mailto:jane@example.com" },
      { text: "Run", url: "javascript:alert(1)" },
    ]);
    expect(links.map((l) => l.url)).toEqual([
      "https://linkedin.com/in/jane/",
      "mailto:jane@example.com",
    ]);
    expect(linksBlock(links)).toContain(
      "- LinkedIn -> https://linkedin.com/in/jane/",
    );
    expect(linksBlock([])).toBe("");
  });
});
