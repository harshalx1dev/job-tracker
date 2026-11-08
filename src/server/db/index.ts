import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import {
  drizzle as drizzlePostgres,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Production: DATABASE_URL (Neon / any Postgres) via postgres.js.
 * Local dev without DATABASE_URL: embedded PGlite stored in ./.data/pglite,
 * so the app runs with zero setup. Both expose the same Drizzle query API.
 */
export type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: DB };

function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: 5, prepare: false });
    return drizzlePostgres(client, { schema, casing: "snake_case" });
  }
  const client = new PGlite(process.env.PGLITE_DIR ?? "./.data/pglite");
  return drizzlePglite(client, {
    schema,
    casing: "snake_case",
  }) as unknown as DB;
}

function getDb(): DB {
  return (globalForDb.__db ??= createDb());
}

/**
 * Connects lazily on first use, so importing this module (e.g. during
 * `next build` page collection across many workers) never opens the database.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export { schema };
