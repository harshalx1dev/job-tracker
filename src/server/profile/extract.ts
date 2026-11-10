import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { AiError } from "@/server/ai/errors";
import {
  cleanLinks,
  linksBlock,
  linksFromHtml,
  textInRect,
  type PdfTextItem,
  type ResumeLink,
} from "@/lib/resume-links";

export const MAX_RESUME_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request cap

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type PdfDoc = Awaited<ReturnType<typeof getDocumentProxy>>;

/** Link annotations (clickable areas) with the words they cover, page by page. */
async function pdfLinks(pdf: PdfDoc): Promise<ResumeLink[]> {
  const links: ResumeLink[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 10); n++) {
    const page = await pdf.getPage(n);
    const annotations = (await page.getAnnotations()) as {
      subtype?: string;
      url?: string;
      unsafeUrl?: string;
      rect?: number[];
    }[];
    const withUrl = annotations.filter(
      (a) => a.subtype === "Link" && (a.url || a.unsafeUrl) && a.rect,
    );
    if (!withUrl.length) continue;
    const content = await page.getTextContent();
    const items: PdfTextItem[] = content.items.flatMap((i) =>
      "str" in i ? [i] : [],
    );
    for (const a of withUrl)
      links.push({
        url: (a.url || a.unsafeUrl)!,
        text: textInRect(items, a.rect!),
      });
  }
  return links;
}

/**
 * Checks size, type and magic bytes (never trusts the extension), then pulls the
 * text, plus the addresses behind clickable words ("LinkedIn", "GitHub") that
 * plain text extraction would lose.
 */
export async function extractResumeText(
  file: File,
): Promise<{ text: string; mime: string }> {
  if (file.size === 0) throw new AiError("BAD_OUTPUT", "That file is empty.");
  if (file.size > MAX_RESUME_BYTES)
    throw new AiError("TOO_LARGE", "Files up to 4 MB, please.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf =
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46; // %PDF
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // PK: .docx is a zip

  let text = "";
  let mime = "";
  let links: ResumeLink[] = [];
  try {
    if (isPdf) {
      mime = PDF;
      const pdf = await getDocumentProxy(bytes);
      text = (await extractText(pdf, { mergePages: true })).text;
      // Links are a bonus: a file whose links can't be read still parses.
      links = await pdfLinks(pdf).catch(() => []);
    } else if (isZip && /\.docx$/i.test(file.name)) {
      mime = DOCX;
      const buffer = Buffer.from(bytes);
      text = (await mammoth.extractRawText({ buffer })).value;
      links = await mammoth
        .convertToHtml({ buffer })
        .then((r) => linksFromHtml(r.value))
        .catch(() => []);
    } else {
      throw new AiError("BAD_OUTPUT", "Upload a PDF or a Word (.docx) file.");
    }
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError(
      "BAD_OUTPUT",
      "That file couldn't be read. Try exporting it again as PDF.",
    );
  }

  text = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < 80) {
    throw new AiError(
      "BAD_OUTPUT",
      "No text found in that file. A scanned resume needs to be exported with selectable text.",
    );
  }
  return { text: text + linksBlock(cleanLinks(links)), mime };
}
