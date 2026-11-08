import { createHash } from "node:crypto";
import { z } from "zod";
import { estimateMinutes, type Priority } from "./prep";

/**
 * Turns a source file into normalised questions. Two formats today:
 *
 * JSON: { "source": { "name", "url"?, "license"? }, "questions": [ { "id"?, "topic", "subtopic"?,
 *         "skills"?: [], "priority"?: "P1|P2|P3", "frequency"?: 0-1, "difficulty"?, "minutes"?,
 *         "question", "answer", "references"?: [] } ] }
 *
 * CSV:  header row with: id, topic, subtopic, skills (separated by ;), priority, frequency,
 *       difficulty, minutes, question, answer, references (separated by ;)
 *       The source name comes from the form.
 *
 * Other formats (Markdown docs, site exports) get their own adapter once the sources are known.
 */

export type ImportedQuestion = {
  externalId: string;
  topic: string;
  subtopic: string | null;
  skills: string[];
  priority: Priority;
  frequency: number;
  difficulty: string | null;
  estMinutes: number;
  question: string;
  answer: string;
  references: string[];
  needsReview: boolean;
};

export type ImportResult = {
  source: { name: string; url: string | null; license: string | null };
  questions: ImportedQuestion[];
  skipped: { row: number; reason: string }[];
};

const rowSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  topic: z.string().trim().min(1, "topic is missing"),
  subtopic: z.string().trim().optional(),
  skills: z.union([z.array(z.string()), z.string()]).optional(),
  priority: z.string().trim().optional(),
  frequency: z.union([z.number(), z.string()]).optional(),
  difficulty: z.string().trim().optional(),
  minutes: z.union([z.number(), z.string()]).optional(),
  question: z.string().trim().min(5, "question is missing"),
  answer: z.string().trim().min(1, "answer is missing"),
  references: z.union([z.array(z.string()), z.string()]).optional(),
});

const list = (v: string[] | string | undefined) =>
  (Array.isArray(v) ? v : (v ?? "").split(";"))
    .map((s) => s.trim())
    .filter(Boolean);

function normalise(
  raw: unknown,
  row: number,
): ImportedQuestion | { row: number; reason: string } {
  const r = rowSchema.safeParse(raw);
  if (!r.success)
    return { row, reason: r.error.issues[0]?.message ?? "invalid row" };
  const d = r.data;
  const pr = (d.priority ?? "").toUpperCase();
  const known = pr === "P1" || pr === "P2" || pr === "P3";
  const priority: Priority = known ? (pr as Priority) : "P2";
  const freq =
    d.frequency === undefined || d.frequency === "" ? NaN : Number(d.frequency);
  const minutes =
    d.minutes === undefined || d.minutes === "" ? NaN : Number(d.minutes);
  const ownId = d.id !== undefined ? String(d.id).trim() : "";
  return {
    // Stable id: the source's own, else a hash of the question, so re-imports update in place.
    externalId:
      ownId ||
      createHash("sha1")
        .update(d.question.toLowerCase())
        .digest("hex")
        .slice(0, 16),
    topic: d.topic,
    subtopic: d.subtopic || null,
    skills: list(d.skills),
    priority,
    frequency: Number.isFinite(freq) ? Math.min(1, Math.max(0, freq)) : 0.5,
    difficulty: d.difficulty || null,
    estMinutes:
      Number.isFinite(minutes) && minutes > 0
        ? Math.min(120, Math.round(minutes))
        : estimateMinutes(d.answer),
    question: d.question,
    answer: d.answer,
    references: list(d.references),
    needsReview: !known,
  };
}

/** Minimal RFC 4180 CSV parser: quotes, escaped quotes, commas and newlines in fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

export function parseQuestionFile(
  fileName: string,
  text: string,
  fallbackSource: { name?: string; url?: string; license?: string } = {},
): ImportResult {
  const skipped: ImportResult["skipped"] = [];
  const questions: ImportedQuestion[] = [];
  let source = {
    name: fallbackSource.name?.trim() || fileName.replace(/\.[^.]+$/, ""),
    url: fallbackSource.url?.trim() || null,
    license: fallbackSource.license?.trim() || null,
  };

  let rows: unknown[] = [];
  if (/\.json$/i.test(fileName)) {
    const data = JSON.parse(text) as {
      source?: { name?: string; url?: string; license?: string };
      questions?: unknown[];
    };
    if (!Array.isArray(data.questions))
      throw new Error('JSON needs a "questions" array');
    if (data.source?.name) {
      source = {
        name: data.source.name.trim(),
        url: data.source.url?.trim() || source.url,
        license: data.source.license?.trim() || source.license,
      };
    }
    rows = data.questions;
  } else if (/\.csv$/i.test(fileName)) {
    const [header, ...body] = parseCsv(text.replace(/^﻿/, ""));
    if (!header) throw new Error("The CSV is empty");
    const keys = header.map((h) => h.trim().toLowerCase());
    for (const need of ["topic", "question", "answer"]) {
      if (!keys.includes(need))
        throw new Error(`The CSV needs a "${need}" column`);
    }
    rows = body.map((cells) =>
      Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ""])),
    );
  } else {
    throw new Error("Upload a .json or .csv file");
  }

  const seen = new Set<string>();
  rows.forEach((raw, i) => {
    const out = normalise(raw, i + 1);
    if ("reason" in out) return void skipped.push(out);
    if (seen.has(out.externalId))
      return void skipped.push({ row: i + 1, reason: "duplicate id" });
    seen.add(out.externalId);
    questions.push(out);
  });
  return { source, questions, skipped };
}
