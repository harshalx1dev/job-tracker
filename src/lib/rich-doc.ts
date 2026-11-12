import {
  headingText,
  isHeadingLine,
  HEADING_PREFIX,
  parseRichText,
  tokensToMarkup,
  type RichToken,
} from "@/lib/rich-text";

/**
 * Converts between what the resume stores (strings with **bold**, *italic*,
 * [links](url), and "## " lines for sub-headings) and the editor's document.
 * The stored format is unchanged, so the renderer, the PDF, the importer and
 * the AI prompts keep working. The editor can only show what these can store:
 * bullets, sub-headings, bold, italic and links.
 */

export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

/* ---- inline text ---- */

export function tokensToInline(tokens: RichToken[]): DocNode[] {
  return tokens.map((t) => {
    const marks: NonNullable<DocNode["marks"]> = [];
    if (t.bold) marks.push({ type: "bold" });
    if (t.italic) marks.push({ type: "italic" });
    if (t.href) marks.push({ type: "link", attrs: { href: t.href } });
    return marks.length
      ? { type: "text", text: t.text, marks }
      : { type: "text", text: t.text };
  });
}

export function inlineToTokens(nodes: DocNode[] = []): RichToken[] {
  const out: RichToken[] = [];
  for (const n of nodes) {
    if (n.type === "hardBreak") {
      out.push({ text: " " });
      continue;
    }
    if (n.type !== "text" || !n.text) continue;
    const t: RichToken = { text: n.text };
    for (const m of n.marks ?? []) {
      if (m.type === "bold") t.bold = true;
      if (m.type === "italic") t.italic = true;
      if (m.type === "link" && typeof m.attrs?.href === "string")
        t.href = m.attrs.href;
    }
    out.push(t);
  }
  return out;
}

const inlineOf = (markup: string) => tokensToInline(parseRichText(markup));
const markupOf = (nodes?: DocNode[]) => tokensToMarkup(inlineToTokens(nodes));

/* ---- a single paragraph (summary, project description) ---- */

export function markupToDoc(markup: string): DocNode {
  const content = inlineOf(markup);
  return {
    type: "doc",
    content: [
      content.length ? { type: "paragraph", content } : { type: "paragraph" },
    ],
  };
}

/** Pasted or odd documents may hold several paragraphs; they become one, joined by spaces. */
export function docToMarkup(doc: DocNode): string {
  return (doc.content ?? [])
    .map((p) => markupOf(p.content).trim())
    .filter(Boolean)
    .join(" ");
}

/* ---- bullets and sub-headings (highlights) ---- */

export function highlightsToDoc(lines: string[], keepEmpty = false): DocNode {
  const blocks: DocNode[] = [];
  let list: DocNode | null = null;
  for (const line of lines) {
    if (!line.trim() && !keepEmpty) continue;
    if (isHeadingLine(line)) {
      list = null;
      blocks.push({
        type: "heading",
        attrs: { level: 3 },
        content: inlineOf(headingText(line)),
      });
      continue;
    }
    if (!list) {
      list = { type: "bulletList", content: [] };
      blocks.push(list);
    }
    list.content!.push({
      type: "listItem",
      content: [{ type: "paragraph", content: inlineOf(line) }],
    });
  }
  // Always something to type into.
  if (!blocks.length)
    blocks.push({
      type: "bulletList",
      content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
    });
  return { type: "doc", content: blocks };
}

/**
 * One line per heading or paragraph, in document order (so line k is the k-th
 * text block). Empty ones are dropped unless keepEmpty.
 */
export function docToLines(doc: DocNode, keepEmpty = false): string[] {
  const lines: string[] = [];
  const walk = (n: DocNode) => {
    if (n.type === "heading") {
      const m = markupOf(n.content).trim();
      if (m || keepEmpty) lines.push(HEADING_PREFIX + m);
    } else if (n.type === "paragraph") {
      const m = markupOf(n.content).trim();
      if (m || keepEmpty) lines.push(m);
    } else n.content?.forEach(walk);
  };
  doc.content?.forEach(walk);
  return lines;
}

/** The lines to store: empty ones dropped. */
export const docToHighlights = (doc: DocNode) => docToLines(doc);
