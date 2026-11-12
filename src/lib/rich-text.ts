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
      // ***bold italic***: one marker that switches both.
      if (
        src.startsWith("***", i) &&
        ((bold && italic) ||
          (!bold && !italic && src.indexOf("***", i + 3) > i + 3))
      ) {
        flush();
        bold = !bold;
        italic = !italic;
        i += 3;
        continue;
      }
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

/* ---- editing helpers for the toolbar (pure: text and selection in, text and selection out) ---- */

export type Edit = { value: string; start: number; end: number };

/** Wraps the selection in a marker (** or *), or removes it when already wrapped. */
export function toggleMarker(
  value: string,
  start: number,
  end: number,
  marker: "**" | "*",
): Edit {
  const m = marker.length;
  const before = value.slice(0, start);
  const sel = value.slice(start, end);
  const after = value.slice(end);
  // A lone * next to ** belongs to the bold marker, not to italics.
  const wrappedOutside =
    before.endsWith(marker) &&
    after.startsWith(marker) &&
    (m === 2 || (!before.endsWith("**") && !after.startsWith("**")));
  if (wrappedOutside)
    return {
      value: before.slice(0, -m) + sel + after.slice(m),
      start: start - m,
      end: end - m,
    };
  return {
    value: before + marker + sel + marker + after,
    start: start + m,
    end: end + m,
  };
}

/** A typed address as a safe link: a bare domain gets https://; anything unsafe is null. */
export function normalizeHref(raw: string): string | null {
  let url = raw.trim();
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(url)) url = `https://${url}`;
  return safeHref(url);
}

/** Turns the selection into [selection](url). Returns null when the address isn't a usable link. */
export function applyLink(
  value: string,
  start: number,
  end: number,
  rawUrl: string,
): Edit | null {
  const href = normalizeHref(rawUrl);
  if (!href) return null;
  const label = value.slice(start, end) || href;
  const link = `[${label}](${href})`;
  return {
    value: value.slice(0, start) + link + value.slice(end),
    start,
    end: start + link.length,
  };
}

/** A highlight line that starts a named group of bullets under a role or project. */
export const HEADING_PREFIX = "## ";
export const isHeadingLine = (s: string) => s.startsWith(HEADING_PREFIX);
export const headingText = (s: string) => s.slice(HEADING_PREFIX.length).trim();

/** A bullet becomes a sub-heading and the other way round. */
export const toggleHeadingLine = (s: string) =>
  isHeadingLine(s) ? headingText(s) : HEADING_PREFIX + s;

/* ---- tokens back to markup (the editor's way to store what it shows) ---- */

const escapeText = (s: string) => s.replace(/[\\*[\]]/g, "\\$&");

/** Markers hug the words: leading and trailing spaces stay outside them. */
function styled(text: string, bold: boolean, italic: boolean) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(escapeText(text))!;
  if (!m[2]) return m[1] + m[3];
  const mark = (bold ? "**" : "") + (italic ? "*" : "");
  return `${m[1]}${mark}${m[2]}${[...mark].reverse().join("")}${m[3]}`;
}

/**
 * Inverse of parseRichText: parseRichText(tokensToMarkup(t)) gives back t
 * (adjacent tokens with the same style merge). Links that aren't safe web or
 * mail addresses are written as plain text.
 */
export function tokensToMarkup(tokens: RichToken[]): string {
  // Merge neighbours with the same style so markers aren't repeated.
  const merged: RichToken[] = [];
  for (const t of tokens) {
    if (!t.text) continue;
    const last = merged[merged.length - 1];
    if (
      last &&
      !!last.bold === !!t.bold &&
      !!last.italic === !!t.italic &&
      last.href === t.href
    )
      last.text += t.text;
    else merged.push({ ...t });
  }
  let out = "";
  let i = 0;
  while (i < merged.length) {
    const t = merged[i];
    const href = t.href ? safeHref(t.href) : null;
    if (!href) {
      out += styled(t.text, !!t.bold, !!t.italic);
      i++;
      continue;
    }
    // One link can hold several styles: [**bold** and plain](url).
    let inner = "";
    while (i < merged.length && merged[i].href === t.href) {
      inner += styled(merged[i].text, !!merged[i].bold, !!merged[i].italic);
      i++;
    }
    out += `[${inner}](${href.replace(/\)/g, "%29").replace(/\s/g, "%20")})`;
  }
  return out;
}

/** Removes the markup, keeping the words. */
export function stripRichText(src: string): string {
  return parseRichText(src)
    .map((t) => t.text)
    .join("");
}
