import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { AiError } from "@/server/ai/errors";

export const MAX_RESUME_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request cap

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Checks size, type and magic bytes (never trusts the extension), then pulls plain text. */
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
  try {
    if (isPdf) {
      mime = PDF;
      const pdf = await getDocumentProxy(bytes);
      text = (await extractText(pdf, { mergePages: true })).text;
    } else if (isZip && /\.docx$/i.test(file.name)) {
      mime = DOCX;
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) }))
        .value;
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
  return { text, mime };
}
