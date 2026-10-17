import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ["apps/web/.env.local", "apps/web/.env"] });

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/server/src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
