import { defineConfig } from "drizzle-kit";

import { assertLocalDatabaseUrl } from "./scripts/local-database-environment";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/server/src/db/schema.ts",
  out: "./drizzle",
  ...(databaseUrl ? { dbCredentials: { url: assertLocalDatabaseUrl(databaseUrl) } } : {}),
});
