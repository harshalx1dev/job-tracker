import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { aiCredentials } from "@/server/db/schema";
import type { CurrentUser } from "@/server/session";
import { MODEL, usageToday } from "./gateway";
import { LIMITS } from "./limits";

export type AiStatus = {
  /** Which key AI calls will use, or null when none is available. */
  source: "user" | "admin" | null;
  last4: string | null;
  validatedAt: Date | null;
  adminKeyAvailable: boolean;
  usedToday: number;
  limitPerDay: number;
  model: string;
};

export async function getAiStatus(user: CurrentUser): Promise<AiStatus> {
  const cred = await db.query.aiCredentials.findFirst({
    where: eq(aiCredentials.userId, user.id),
    columns: { last4: true, validatedAt: true },
  });
  const adminKeyAvailable =
    user.role === "admin" && Boolean(process.env.ADMIN_GEMINI_API_KEY);
  const source = cred ? "user" : adminKeyAvailable ? "admin" : null;
  return {
    source,
    last4: cred?.last4 ?? null,
    validatedAt: cred?.validatedAt ?? null,
    adminKeyAvailable,
    usedToday: await usageToday(user.id),
    limitPerDay: LIMITS[source ?? "user"].perDay,
    model: MODEL,
  };
}
