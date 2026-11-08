/**
 * Imports a question bank file (JSON or CSV) from the command line.
 *
 *   npm run db:import-questions -- data/sample-question-bank.json
 *   npm run db:import-questions -- path/to/bank.csv --name "My source" --license "with permission"
 *
 * Stop `npm run dev` first when using local PGlite (one process per database folder).
 */
import { mkdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";
import { parseQuestionFile } from "../src/lib/question-import";
import { writeImport } from "../src/server/prep/importer";

type DB = PostgresJsDatabase<typeof schema>;

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = process.argv
    .slice(2)
    .find(
      (a) =>
        !a.startsWith("--") &&
        !process.argv[process.argv.indexOf(a) - 1]?.startsWith("--"),
    );
  if (!file)
    throw new Error(
      "Usage: npm run db:import-questions -- <file.json|file.csv> [--name ..] [--url ..] [--license ..]",
    );

  const result = parseQuestionFile(basename(file), readFileSync(file, "utf8"), {
    name: arg("name"),
    url: arg("url"),
    license: arg("license"),
  });

  let db: DB;
  let close: () => Promise<unknown>;
  if (process.env.DATABASE_URL) {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(process.env.DATABASE_URL, { max: 1 });
    db = drizzle(client, { schema, casing: "snake_case" });
    close = () => client.end();
  } else {
    const dir = process.env.PGLITE_DIR ?? "./.data/pglite";
    mkdirSync(dir, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite(dir);
    db = drizzle(client, { schema, casing: "snake_case" }) as unknown as DB;
    close = () => client.close();
  }

  const out = await writeImport(db, result);
  console.log(
    `✓ ${result.source.name}: ${out.imported} imported, ${out.total} in source, ${out.skipped} skipped`,
  );
  for (const s of result.skipped.slice(0, 20))
    console.log(`  row ${s.row}: ${s.reason}`);
  await close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
