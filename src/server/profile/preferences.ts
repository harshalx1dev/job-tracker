import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { jobPreferences } from "@/server/db/schema";
import {
  emptyPreferences,
  readPreferences,
  type Preferences,
} from "@/lib/preferences";

/** Empty when nothing is saved, or when the table isn't migrated yet (so the app never fails on it). */
export async function getPreferences(userId: string): Promise<Preferences> {
  try {
    const row = await db.query.jobPreferences.findFirst({
      where: eq(jobPreferences.userId, userId),
    });
    return row ? readPreferences(row.data) : emptyPreferences();
  } catch (err) {
    console.error("job_preferences unavailable (run npm run db:migrate)", err);
    return emptyPreferences();
  }
}
