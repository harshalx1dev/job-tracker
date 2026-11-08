"use server";

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { user as userTable } from "@/server/db/schema";
import { requireUser } from "@/server/session";

/**
 * Deletes the account and everything in it (jobs, resumes, answers, plans, keys):
 * every table references the user with ON DELETE CASCADE. Sessions go with it.
 */
export async function deleteAccount(
  confirmEmail: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Type your email exactly to confirm." };
  }
  await db.delete(userTable).where(eq(userTable.id, user.id));
  return { ok: true };
}
