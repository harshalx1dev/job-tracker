/**
 * Resumes often show "LinkedIn | GitHub | Portfolio" as clickable words. The
 * address lives in the file's link data (PDF link annotations, Word
 * hyperlinks), not in the visible text, so plain text extraction loses it.
 * These helpers pair each address with the words it sits on, so the parser
 * gets real URLs instead of guessing them from labels.
 */

export type ResumeLink = { text: string; url: string };

/** A PDF text item: its string and position (pdf.js transform: e = x, f = y). */
export type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

/** The visible words inside a link annotation's rectangle [x1, y1, x2, y2]. */
export function textInRect(items: PdfTextItem[], rect: number[]) {
  const [x1, y1, x2, y2] = [
    Math.min(rect[0], rect[2]),
    Math.min(rect[1], rect[3]),
    Math.max(rect[0], rect[2]),
    Math.max(rect[1], rect[3]),
  ];
  const tol = 2;
  return items
    .filter((it) => {
      const x = it.transform[4];
      const y = it.transform[5];
      const midX = x + it.width / 2;
      const midY = y + (it.height || 0) / 2;
      return (
        midX >= x1 - tol &&
        midX <= x2 + tol &&
        midY >= y1 - tol &&
        midY <= y2 + tol
      );
    })
    .map((it) => it.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

/** Hyperlinks from mammoth's HTML for a .docx file. */
export function linksFromHtml(html: string): ResumeLink[] {
  const out: ResumeLink[] = [];
  for (const m of html.matchAll(
    /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const url = decode(m[1]).trim();
    if (url.startsWith("#")) continue; // internal bookmarks
    out.push({
      url,
      text: decode(m[2].replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim(),
    });
  }
  return out;
}

/** Only web, mail and phone links; no duplicates. */
export function cleanLinks(links: ResumeLink[]): ResumeLink[] {
  const seen = new Set<string>();
  const out: ResumeLink[] = [];
  for (const l of links) {
    const url = l.url.trim();
    if (!/^(https?:|mailto:|tel:)/i.test(url)) continue;
    const key = url.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, text: l.text.slice(0, 80) });
  }
  return out.slice(0, 30);
}

/** The block appended to the resume text for the parser. Empty when there are no links. */
export function linksBlock(links: ResumeLink[]) {
  if (!links.length) return "";
  return [
    "",
    "Links in the file (the address behind each clickable text):",
    ...links.map((l) => `- ${l.text || "(no visible text)"} -> ${l.url}`),
  ].join("\n");
}
