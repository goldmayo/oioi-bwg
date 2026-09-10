import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres, { type Sql } from "postgres";

const MIGRATIONS_FOLDER = resolve(fileURLToPath(new URL("../drizzle", import.meta.url)));
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";
const MIGRATION_LOCK = "oioi-bwg:drizzle-migrations";

async function ensureMigrationMetadata(sql: Sql) {
  const [schema] = await sql<{ exists: boolean }[]>`
    select exists(select 1 from pg_namespace where nspname = ${MIGRATIONS_SCHEMA})
  `;

  // Drizzle's default PostgreSQL migrator always issues CREATE SCHEMA IF NOT EXISTS,
  // which requires database-level CREATE even when the schema already exists. Only
  // bootstrap the schema when it is genuinely absent so the steady-state migrator
  // can remain limited to CREATE/USAGE inside the approved schemas.
  if (!schema?.exists) {
    await sql`create schema ${sql(MIGRATIONS_SCHEMA)}`;
  }

  await sql`
    create table if not exists ${sql(MIGRATIONS_SCHEMA)}.${sql(MIGRATIONS_TABLE)} (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `;
}

export async function runDrizzleMigrations(databaseUrl: string) {
  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  const database = postgres(databaseUrl, {
    max: 1,
    connection: { statement_timeout: 30_000 },
  });

  try {
    let applied = 0;
    await database.begin(async (sql) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${MIGRATION_LOCK}, 0))`;
      await ensureMigrationMetadata(sql);

      const [latest] = await sql<{ created_at: string }[]>`
        select created_at
        from ${sql(MIGRATIONS_SCHEMA)}.${sql(MIGRATIONS_TABLE)}
        order by created_at desc
        limit 1
      `;
      const latestTimestamp = latest ? Number(latest.created_at) : undefined;

      for (const migration of migrations) {
        if (latestTimestamp !== undefined && latestTimestamp >= migration.folderMillis) continue;

        for (const statement of migration.sql) {
          if (statement.trim()) await sql.unsafe(statement);
        }
        await sql`
          insert into ${sql(MIGRATIONS_SCHEMA)}.${sql(MIGRATIONS_TABLE)} (hash, created_at)
          values (${migration.hash}, ${migration.folderMillis})
        `;
        applied += 1;
      }
    });

    console.log(`Drizzle migrations applied: ${applied}`);
  } finally {
    await database.end();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  await runDrizzleMigrations(databaseUrl);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "PostgreSQL migration failed");
    process.exitCode = 1;
  });
}
