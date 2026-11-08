import { count, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/server/db/schema";
import type { ImportResult } from "@/lib/question-import";

type DB = PostgresJsDatabase<typeof schema>;

/**
 * Writes an import into the bank. Sources are matched by name and questions by
 * (source, external id), so re-importing a file updates it in place.
 * No "server-only" import: the CLI script uses this too.
 */
export async function writeImport(db: DB, result: ImportResult) {
  const { questionSources, questions } = schema;
  const [source] = await db
    .insert(questionSources)
    .values({
      name: result.source.name,
      url: result.source.url,
      license: result.source.license,
    })
    .onConflictDoUpdate({
      target: questionSources.name,
      set: {
        url: result.source.url,
        license: result.source.license,
        importedAt: new Date(),
      },
    })
    .returning({ id: questionSources.id });

  const CHUNK = 200;
  for (let i = 0; i < result.questions.length; i += CHUNK) {
    const rows = result.questions
      .slice(i, i + CHUNK)
      .map((q) => ({ ...q, sourceId: source.id }));
    await db
      .insert(questions)
      .values(rows)
      .onConflictDoUpdate({
        target: [questions.sourceId, questions.externalId],
        set: {
          topic: sql`excluded.topic`,
          subtopic: sql`excluded.subtopic`,
          skills: sql`excluded.skills`,
          priority: sql`excluded.priority`,
          frequency: sql`excluded.frequency`,
          difficulty: sql`excluded.difficulty`,
          estMinutes: sql`excluded.est_minutes`,
          question: sql`excluded.question`,
          answer: sql`excluded.answer`,
          references: sql`excluded.references`,
          needsReview: sql`excluded.needs_review`,
        },
      });
  }

  const [{ n }] = await db
    .select({ n: count() })
    .from(questions)
    .where(eq(questions.sourceId, source.id));
  await db
    .update(questionSources)
    .set({ questionCount: n })
    .where(eq(questionSources.id, source.id));
  return {
    sourceId: source.id,
    imported: result.questions.length,
    total: n,
    skipped: result.skipped.length,
  };
}
