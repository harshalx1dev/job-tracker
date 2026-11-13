"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { contacts, jobEvents, jobs } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import type { ActionResult } from "./actions";
import { plansForJob } from "@/server/prep/queries";
import { listApplications } from "./queries";

/** Blank strings become undefined, then the field's own rule applies. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
    schema.optional(),
  );

const contactInput = z.object({
  name: z.string().trim().min(1, "Add a name").max(80),
  role: optional(z.string().max(80)),
  email: optional(z.email("Enter a valid email")),
  linkedinUrl: optional(
    z
      .url("Enter a valid URL")
      .refine(
        (u) => /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(u),
        "Use a linkedin.com link",
      ),
  ),
});

export type ContactInput = z.input<typeof contactInput>;

async function ownJob(userId: string, jobId: string) {
  return db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)),
    columns: { id: true },
  });
}

/** Everything the job drawer loads on open: timeline and contacts. */
export async function getJobExtras(jobId: string) {
  const user = await requireUser();
  const [events, people, plans, applications] = await Promise.all([
    db
      .select()
      .from(jobEvents)
      .where(and(eq(jobEvents.jobId, jobId), eq(jobEvents.userId, user.id)))
      .orderBy(desc(jobEvents.createdAt))
      .limit(50),
    db
      .select()
      .from(contacts)
      .where(and(eq(contacts.jobId, jobId), eq(contacts.userId, user.id)))
      .orderBy(asc(contacts.createdAt)),
    plansForJob(user.id, jobId),
    listApplications(user.id, jobId),
  ]);
  return {
    events,
    contacts: people,
    applications,
    plans: plans.map((p) => ({
      id: p.id,
      kind: p.kind,
      days: p.days,
      total: p.total,
      minutes: p.minutes,
      done: p.done,
    })),
  };
}

export async function addContact(
  jobId: string,
  input: ContactInput,
): Promise<ActionResult<typeof contacts.$inferSelect>> {
  const user = await requireUser();
  const parsed = contactInput.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid contact",
    };
  if (!(await ownJob(user.id, jobId)))
    return { ok: false, error: "Job not found" };

  const [row] = await db
    .insert(contacts)
    .values({ ...parsed.data, jobId, userId: user.id })
    .returning();
  return { ok: true, data: row };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const res = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, user.id)))
    .returning({ id: contacts.id });
  if (!res.length) return { ok: false, error: "Contact not found" };
  return { ok: true, data: undefined };
}
