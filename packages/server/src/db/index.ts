import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabase>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Database | Transaction;

const globalForDatabase = globalThis as typeof globalThis & {
  __oioiDatabase?: Database;
};

export function getDatabase(): Database {
  if (!globalForDatabase.__oioiDatabase) {
    globalForDatabase.__oioiDatabase = createDatabase();
  }

  return globalForDatabase.__oioiDatabase;
}
