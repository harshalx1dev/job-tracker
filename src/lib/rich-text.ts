/**
 * Tiny, safe inline formatting for resume text: **bold**, *italic*, [text](url).
 * Pure: returns tokens, never HTML. Only http(s) and mailto links are kept.
 */
export type RichToken = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
};

export function safeHref(url: string): string | null {
  const u = url.trim();
  return /^(https?:\/\/|mailto:)[^\s]+$/i.test(u) ? u : null;
}

type Style = { bold: boolean; italic: boolean; href?: string };

function push(out: RichToken[], text: string, s: Style) {
  if (!text) return;
  const t: RichToken = { text };
  if (s.bold) t.bold = true;
  if (s.italic) t.italic = true;
  if (s.href) t.href = s.href;
  const last = out[out.length - 1];
  if (
    last &&
    !!last.bold === !!t.bold &&
    !!last.italic === !!t.italic &&
    last.href === t.href
  ) {
    last.text += text;
  } else out.push(t);
}

function parse(src: string, base: Style, out: RichToken[]) {
  let { bold, italic } = base;
  let buf = "";
  const flush = () => {
    push(out, buf, { bold, italic, href: base.href });
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < src.length && "*[]\\".includes(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === "[" && !base.href) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(src.slice(i));
      const href = m ? safeHref(m[2]) : null;
      if (m && href) {
        flush();
        parse(m[1], { bold, italic, href }, out);
        i += m[0].length;
        continue;
      }
    }
    if (ch === "*") {
      if (src[i + 1] === "*") {
        // Only toggle when it can close, or when a closing marker exists.
        if (bold || src.indexOf("**", i + 2) > i + 2) {
          flush();
          bold = !bold;
          i += 2;
          continue;
        }
      } else if (italic || hasSingleStar(src, i + 1)) {
        flush();
        italic = !italic;
        i += 1;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  flush();
}

function hasSingleStar(src: string, from: number) {
  for (let j = from; j < src.length; j++) {
    if (src[j] === "*" && src[j + 1] !== "*" && src[j - 1] !== "*")
      return j > from;
  }
  return false;
}

export function parseRichText(src: string): RichToken[] {
  const out: RichToken[] = [];
  parse(src ?? "", { bold: false, italic: false }, out);
  return out;
}

/** Removes the markup, keeping the words. */
export function stripRichText(src: string): string {
  return parseRichText(src)
    .map((t) => t.text)
    .join("");
}
