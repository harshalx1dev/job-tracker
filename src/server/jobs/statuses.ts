import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { statuses } from "@/server/db/schema";
import { DEFAULT_STATUSES } from "@/lib/status-colors";

export async function seedDefaultStatuses(userId: string) {
  await db.insert(statuses).values(
    DEFAULT_STATUSES.map((s, i) => ({
      userId,
      name: s.name,
      color: s.color,
      kind: s.kind,
      position: i,
    })),
  );
}

export async function listStatuses(userId: string) {
  const rows = await db
    .select()
    .from(statuses)
    .where(eq(statuses.userId, userId))
    .orderBy(asc(statuses.position));
  if (rows.length === 0) {
    // Users created before seeding existed (or via OAuth edge cases).
    await seedDefaultStatuses(userId);
    return listStatuses(userId);
  }
  return rows;
}
