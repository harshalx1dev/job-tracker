"use server";

import { refresh } from "next/cache";
import { db } from "@/server/db";
import { jobPreferences } from "@/server/db/schema";
import { preferencesSchema, type Preferences } from "@/lib/preferences";
import type { ActionResult } from "@/server/jobs/actions";
import { requireUser } from "@/server/session";

export async function savePreferences(
  input: unknown,
): Promise<ActionResult<Preferences>> {
  const user = await requireUser();
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Check the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  await db
    .insert(jobPreferences)
    .values({ userId: user.id, data: parsed.data })
    .onConflictDoUpdate({
      target: jobPreferences.userId,
      set: { data: parsed.data, updatedAt: new Date() },
    });
  refresh();
  return { ok: true, data: parsed.data };
}
