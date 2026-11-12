"use server";

import { and, eq, not } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { outreachMessages } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import {
  CHANNELS,
  checkLimits,
  limitsFor,
  outreachRequestSchema,
  outreachSaveSchema,
  type OutreachDraft,
  type OutreachRequest,
} from "@/lib/outreach";
import { jobContext, requireProfile } from "./context";
import { toAiError, type AiResult } from "./errors";
import { generateOutreach } from "./features";

export async function generateOutreachAction(
  input: OutreachRequest,
): Promise<AiResult<OutreachDraft[]>> {
  const user = await requireUser();
  const parsed = outreachRequestSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: "BAD_OUTPUT",
      error: "Check the form and try again.",
    };
  const req = parsed.data;
  try {
    const profile = await requireProfile(user.id);
    const job = await jobContext(user.id, req.jobId);
    const limits = limitsFor(req.channel, req.premium);
    const channel = CHANNELS.find((c) => c.id === req.channel)!;
    const { variants } = await generateOutreach(user, profile, job, {
      channelLabel: channel.label,
      ...limits,
      tone: req.tone,
      recipientName: req.recipientName,
      recipientRole: req.recipientRole,
      goal: req.goal,
    });
    return { ok: true, data: checkLimits(variants, limits) };
  } catch (err) {
    const e = toAiError(err);
    return { ok: false, code: e.code, error: e.message };
  }
}

const saveSchema = outreachSaveSchema;

export async function saveOutreach(input: z.input<typeof saveSchema>) {
  const user = await requireUser();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid message",
    };
  const [row] = await db
    .insert(outreachMessages)
    .values({
      ...parsed.data,
      jobId: parsed.data.jobId || null,
      userId: user.id,
    })
    .returning({ id: outreachMessages.id });
  refresh();
  return { ok: true as const, data: { id: row.id } };
}

export async function toggleOutreachFavorite(id: string) {
  const user = await requireUser();
  await db
    .update(outreachMessages)
    .set({ favorite: not(outreachMessages.favorite) })
    .where(
      and(eq(outreachMessages.id, id), eq(outreachMessages.userId, user.id)),
    );
  refresh();
}

export async function deleteOutreach(id: string) {
  const user = await requireUser();
  await db
    .delete(outreachMessages)
    .where(
      and(eq(outreachMessages.id, id), eq(outreachMessages.userId, user.id)),
    );
  refresh();
}
