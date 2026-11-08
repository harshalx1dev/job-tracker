/**
 * Applies SQL migrations from ./drizzle.
 * Uses DATABASE_URL when set, otherwise the local PGlite database.
 * Run: npm run db:migrate
 */
import { mkdirSync } from "node:fs";

async function main() {
  // Migrations and scripts use the direct (unpooled) connection when there is one.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 1 });
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.end();
  } else {
    const dir = process.env.PGLITE_DIR ?? "./.data/pglite";
    mkdirSync(dir, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(dir);
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.close();
  }
  console.log("✓ migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
