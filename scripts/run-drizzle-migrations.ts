import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres, { type TransactionSql } from "postgres";

import { loadLocalDatabaseUrl } from "./local-database-environment";
import { parseUuidCutoverMap } from "../tools/repository/src/operators/uuid-cutover-map";

const MIGRATIONS_FOLDER = resolve(fileURLToPath(new URL("../drizzle", import.meta.url)));
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";
const MIGRATION_LOCK = "oioi-bwg:drizzle-migrations";

async function ensureMigrationMetadata(sql: TransactionSql) {
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

export async function runDrizzleMigrations(
  databaseUrl: string,
  uuidMap?: unknown,
  legacySchemaOnly = false,
) {
  if (legacySchemaOnly && uuidMap !== undefined)
    throw new Error("Legacy schema preparation cannot apply a UUID map");
  let mapping: ReturnType<typeof parseUuidCutoverMap> | undefined;
  if (uuidMap !== undefined) {
    try {
      mapping = parseUuidCutoverMap(uuidMap);
    } catch {
      throw new Error("UUID cutover map rejected");
    }
  }
  const allMigrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  // The legacy dump contains integer IDs. Prepare exactly the pre-cutover checkpoint for restore.
  const migrations = legacySchemaOnly ? allMigrations.slice(0, 6) : allMigrations;
  const database = postgres(databaseUrl, {
    max: 1,
    connection: { statement_timeout: 30_000 },
  });

  try {
    let applied = 0;
    await database.begin(async (sql) => {
      await sql`set local lock_timeout = '5s'`;
      await sql`select pg_advisory_xact_lock(hashtextextended(${MIGRATION_LOCK}, 0))`;
      if (mapping !== undefined) {
        await sql`select set_config('oioi.uuid_cutover_map', ${JSON.stringify(mapping)}, true)`;
      }
      await ensureMigrationMetadata(sql);

      const [latest] = await sql<{ created_at: string }[]>`
        select created_at
        from ${sql(MIGRATIONS_SCHEMA)}.${sql(MIGRATIONS_TABLE)}
        order by created_at desc
        limit 1
      `;
      const latestTimestamp = latest ? Number(latest.created_at) : undefined;
      if (
        legacySchemaOnly &&
        latestTimestamp !== undefined &&
        latestTimestamp > migrations.at(-1)!.folderMillis
      ) {
        throw new Error(
          "A UUID database cannot be downgraded; use a fresh isolated restore target",
        );
      }

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
  const args = process.argv.slice(2);
  const legacySchemaOnly = args.includes("--legacy-schema");
  if (legacySchemaOnly) args.splice(args.indexOf("--legacy-schema"), 1);
  const index = args.indexOf("--uuid-map");
  let uuidMap: unknown;
  if (index !== -1) {
    const file = args[index + 1];
    if (!file || file.startsWith("--")) throw new Error("--uuid-map requires a JSON file");
    try {
      uuidMap = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      throw new Error("UUID cutover map file rejected");
    }
    args.splice(index, 2);
  }
  const databaseUrl = loadLocalDatabaseUrl(args);
  await runDrizzleMigrations(databaseUrl, uuidMap, legacySchemaOnly);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "PostgreSQL migration failed");
    process.exitCode = 1;
  });
}
