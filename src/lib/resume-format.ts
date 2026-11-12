/**
 * Plain text extraction throws away what the author emphasised: bold lead-ins,
 * italics. These helpers keep it as the same **bold** / *italic* markup the
 * editor and the resume renderer use, so the parser can carry it through.
 */

export type StyledItem = {
  str: string;
  bold: boolean;
  italic: boolean;
  /** pdf.js: the item ends a line. */
  eol?: boolean;
};

/** Font names like "OpenSans-BoldItalic" or "ABCDEF+Arial,Bold" carry the style. */
export function fontStyle(name: string): { bold: boolean; italic: boolean } {
  return {
    bold: /bold|black|heavy|semibold|demi/i.test(name),
    italic: /italic|oblique/i.test(name),
  };
}

const wrap = (text: string, bold: boolean, italic: boolean) => {
  // Markers hug the words: spaces stay outside, or the markup would not parse.
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  if (!m[2]) return text;
  const mark = (bold ? "**" : "") + (italic ? "*" : "");
  return `${m[1]}${mark}${m[2]}${[...mark].reverse().join("")}${m[3]}`;
};

/** PDF text items to text, with styled runs wrapped in markers (a run never crosses a line). */
export function markPdfText(items: StyledItem[]): string {
  let out = "";
  let run = "";
  let bold = false;
  let italic = false;
  const flush = () => {
    out += wrap(run, bold, italic);
    run = "";
  };
  for (const it of items) {
    // Spaces between two bold words belong to the run, not to a style change.
    const blank = !it.str.trim();
    if (!blank && (it.bold !== bold || it.italic !== italic)) {
      flush();
      bold = it.bold;
      italic = it.italic;
    }
    run += it.str;
    if (it.eol) {
      flush();
      out += "\n";
    }
  }
  flush();
  return out;
}

const entities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** mammoth's HTML for a .docx to text with **bold** / *italic* markers and one line per paragraph or bullet. */
export function htmlToMarked(html: string): string {
  return (
    entities(
      html
        .replace(/<\/?(strong|b)\b[^>]*>/gi, "**")
        .replace(/<\/?(em|i)\b[^>]*>/gi, "*")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|li|h[1-6]|tr|div|ul|ol|table)>/gi, "\n")
        .replace(/<\/t[dh]>/gi, " ")
        .replace(/<[^>]+>/g, ""),
    )
      // Adjacent runs ("**a** **b**" or "**a****b**") read better merged.
      .replace(/\*\*(\s*)\*\*/g, "$1")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
