import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/libs/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
});
