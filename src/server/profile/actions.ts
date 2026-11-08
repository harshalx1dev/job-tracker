"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { profiles, resumeUploads } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import {
  mergeProfile,
  profileSchema,
  PROFILE_SECTIONS,
  type Profile,
} from "@/lib/profile";
import { toAiError, type AiResult } from "@/server/ai/errors";
import { parseResume } from "@/server/ai/features";
import { extractResumeText } from "./extract";
import { getProfile } from "./queries";

export async function saveProfile(data: Profile): Promise<AiResult<null>> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      code: "BAD_OUTPUT",
      error: parsed.error.issues[0]?.message ?? "Some fields are too long",
    };
  }
  await db
    .insert(profiles)
    .values({ userId: user.id, data: parsed.data })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { data: parsed.data },
    });
  refresh();
  return { ok: true, data: null };
}

/**
 * Upload → extract text → AI parse. Nothing in the profile changes here: the result is
 * stored on the upload for the review screen, where the user picks what to keep.
 */
export async function uploadResume(
  form: FormData,
): Promise<AiResult<{ uploadId: string; fileName: string; parsed: Profile }>> {
  const user = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File))
    return { ok: false, code: "BAD_OUTPUT", error: "Choose a file to upload." };

  try {
    const { text, mime } = await extractResumeText(file);
    const parsed = await parseResume(user, text);
    const [row] = await db
      .insert(resumeUploads)
      .values({
        userId: user.id,
        fileName: file.name.slice(0, 200),
        mimeType: mime,
        sizeBytes: file.size,
        extractedText: text,
        parsed,
      })
      .returning({ id: resumeUploads.id });
    return {
      ok: true,
      data: { uploadId: row.id, fileName: file.name, parsed },
    };
  } catch (err) {
    const e = toAiError(err);
    return { ok: false, code: e.code, error: e.message };
  }
}

const sectionKeys = PROFILE_SECTIONS.map((s) => s.key) as [string, ...string[]];

/** Copies the chosen sections from a reviewed upload into the profile. */
export async function applyParsedResume(
  uploadId: string,
  sections: string[],
): Promise<AiResult<null>> {
  const user = await requireUser();
  const chosen = z
    .array(z.enum(sectionKeys))
    .min(1, "Pick at least one section")
    .safeParse(sections);
  if (!chosen.success)
    return {
      ok: false,
      code: "BAD_OUTPUT",
      error: chosen.error.issues[0].message,
    };

  const upload = await db.query.resumeUploads.findFirst({
    where: and(
      eq(resumeUploads.id, uploadId),
      eq(resumeUploads.userId, user.id),
    ),
  });
  if (!upload?.parsed)
    return { ok: false, code: "FAILED", error: "That upload wasn't found." };

  const { profile } = await getProfile(user.id);
  const next = mergeProfile(
    profile,
    upload.parsed,
    chosen.data as (typeof PROFILE_SECTIONS)[number]["key"][],
  );
  await db.transaction(async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId: user.id, data: next })
      .onConflictDoUpdate({ target: profiles.userId, set: { data: next } });
    await tx
      .update(resumeUploads)
      .set({ appliedAt: new Date() })
      .where(eq(resumeUploads.id, uploadId));
  });
  refresh();
  return { ok: true, data: null };
}

export async function discardUpload(uploadId: string): Promise<AiResult<null>> {
  const user = await requireUser();
  await db
    .delete(resumeUploads)
    .where(
      and(eq(resumeUploads.id, uploadId), eq(resumeUploads.userId, user.id)),
    );
  refresh();
  return { ok: true, data: null };
}
