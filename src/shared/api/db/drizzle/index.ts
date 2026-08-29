import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return drizzle(postgres(databaseUrl), { schema });
}

type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as typeof globalThis & {
  __oioiDb?: Db;
};

export function getDb(): Db {
  if (!globalForDb.__oioiDb) {
    globalForDb.__oioiDb = createDb();
  }

  return globalForDb.__oioiDb;
}
