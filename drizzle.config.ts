import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  ...(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
    ? { dbCredentials: { url: (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)! } }
    : { driver: "pglite", dbCredentials: { url: "./.data/pglite" } }),
});
