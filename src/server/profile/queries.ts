import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { profiles, resumeUploads } from "@/server/db/schema";
import { emptyProfile, profileSchema, type Profile } from "@/lib/profile";

export async function getProfile(
  userId: string,
): Promise<{ profile: Profile; saved: boolean }> {
  const row = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });
  if (!row) return { profile: emptyProfile(), saved: false };
  // Stored data is re-validated so older shapes never crash the editor.
  const parsed = profileSchema.safeParse({ ...emptyProfile(), ...row.data });
  return {
    profile: parsed.success ? parsed.data : emptyProfile(),
    saved: true,
  };
}

/** The newest parsed upload not yet applied, so a review can be resumed after a reload. */
export async function getPendingUpload(userId: string) {
  return (
    (await db.query.resumeUploads.findFirst({
      where: and(
        eq(resumeUploads.userId, userId),
        isNull(resumeUploads.appliedAt),
      ),
      orderBy: desc(resumeUploads.createdAt),
      columns: { id: true, fileName: true, parsed: true, createdAt: true },
    })) ?? null
  );
}
