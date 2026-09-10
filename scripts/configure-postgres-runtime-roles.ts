import { fileURLToPath } from "node:url";

import postgres, { type Sql } from "postgres";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PRODUCTION_ACK = "I_UNDERSTAND_THIS_CHANGES_DATABASE_ROLES";
const APPLICATION_TABLES = [
  "Album",
  "Song",
  "account",
  "profile",
  "password_credential",
  "email_verification_challenge",
  "email_verification_rate_limit",
] as const;
const APPLICATION_SEQUENCES = ["Album_id_seq", "Song_id_seq", "account_id_seq"] as const;
const DRIZZLE_TABLE = "__drizzle_migrations";
const DRIZZLE_SEQUENCE = "__drizzle_migrations_id_seq";

type RoleConfiguration = {
  adminUrl: string;
  appPassword: string;
  appRole?: string;
  migratorPassword: string;
  migratorRole?: string;
};

function assertRoleName(value: string) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`Invalid PostgreSQL role identifier: ${value}`);
  }
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function requireRelation(sql: Sql, schema: string, name: string, kinds: string[]) {
  const [relation] = await sql<{ kind: string }[]>`
    select relation.relkind as kind
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = ${schema} and relation.relname = ${name}
  `;
  if (!relation || !kinds.includes(relation.kind)) {
    throw new Error(
      `Required PostgreSQL relation is missing or has the wrong kind: ${schema}.${name}`,
    );
  }
}

async function transferTable(sql: Sql, schema: string, name: string, owner: string) {
  await requireRelation(sql, schema, name, ["r", "p"]);
  await sql`alter table ${sql(schema)}.${sql(name)} owner to ${sql(owner)}`;
}

async function transferSequence(sql: Sql, schema: string, name: string, owner: string) {
  await requireRelation(sql, schema, name, ["S"]);
  await sql`alter sequence ${sql(schema)}.${sql(name)} owner to ${sql(owner)}`;
}

async function setLoginPassword(sql: Sql, role: string, password: string) {
  const [row] = await sql<{ statement: string }[]>`
    select format(
      'alter role %I login password %L',
      ${role}::text,
      ${password}::text
    ) as statement
  `;
  if (!row) throw new Error(`Could not prepare password statement for ${role}`);
  await sql.unsafe(row.statement);
}

async function ensureRole(sql: Sql, role: string, password: string) {
  const [existing] = await sql<{ exists: boolean }[]>`
    select exists(select 1 from pg_roles where rolname = ${role})
  `;

  if (!existing?.exists) {
    await sql`create role ${sql(role)}`;
  }
  await sql`
    alter role ${sql(role)}
    nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls
  `;
  await setLoginPassword(sql, role, password);
}

export async function configurePostgresRuntimeRoles({
  adminUrl,
  appPassword,
  appRole = "oioi_app",
  migratorPassword,
  migratorRole = "oioi_migrator",
}: RoleConfiguration) {
  assertRoleName(appRole);
  assertRoleName(migratorRole);
  if (appRole === migratorRole) throw new Error("Application and migrator roles must differ");
  if (!appPassword || !migratorPassword) throw new Error("Both role passwords are required");

  const admin = postgres(adminUrl, { max: 1, connection: { statement_timeout: 30_000 } });
  try {
    const [context] = await admin<{ database_name: string; is_superuser: boolean }[]>`
      select current_database() as database_name,
             current_setting('is_superuser')::boolean as is_superuser
    `;
    if (!context?.is_superuser) throw new Error("Role bootstrap requires a PostgreSQL superuser");

    await admin.begin(async (sql) => {
      await sql`set local lock_timeout = '5s'`;
      await ensureRole(sql, migratorRole, migratorPassword);
      await ensureRole(sql, appRole, appPassword);

      const memberships = await sql<{ granted_role: string }[]>`
        select granted.rolname as granted_role
        from pg_auth_members membership
        join pg_roles member on member.oid = membership.member
        join pg_roles granted on granted.oid = membership.roleid
        where member.rolname = ${appRole}
      `;
      for (const { granted_role: grantedRole } of memberships) {
        await sql`revoke ${sql(grantedRole)} from ${sql(appRole)}`;
      }

      await sql`revoke create on schema public from ${sql(appRole)}`;
      await sql`grant usage on schema public to ${sql(appRole)}`;
      await sql`grant usage, create on schema public to ${sql(migratorRole)}`;

      // This allowlist mirrors the tracked Drizzle schema/migrations. Do not broaden it to all
      // public relations: the production database also contains extension- and host-owned objects.
      for (const table of APPLICATION_TABLES) {
        await transferTable(sql, "public", table, migratorRole);
      }
      for (const sequence of APPLICATION_SEQUENCES) {
        await transferSequence(sql, "public", sequence, migratorRole);
      }

      const [drizzleSchema] = await sql<{ exists: boolean }[]>`
        select exists(select 1 from pg_namespace where nspname = 'drizzle')
      `;
      if (!drizzleSchema?.exists) throw new Error("Required PostgreSQL schema is missing: drizzle");
      await sql`grant usage, create on schema drizzle to ${sql(migratorRole)}`;
      await transferTable(sql, "drizzle", DRIZZLE_TABLE, migratorRole);
      await transferSequence(sql, "drizzle", DRIZZLE_SEQUENCE, migratorRole);

      for (const table of APPLICATION_TABLES) {
        await sql`
          grant select, insert, update, delete on table ${sql("public")}.${sql(table)} to ${sql(appRole)}
        `;
      }
      for (const sequence of APPLICATION_SEQUENCES) {
        await sql`
          grant usage, select on sequence ${sql("public")}.${sql(sequence)} to ${sql(appRole)}
        `;
      }

      await sql`
        alter default privileges for role ${sql(migratorRole)} in schema public
        grant select, insert, update, delete on tables to ${sql(appRole)}
      `;
      await sql`
        alter default privileges for role ${sql(migratorRole)} in schema public
        grant usage, select on sequences to ${sql(appRole)}
      `;

      await sql.unsafe(
        `grant connect on database ${quoteIdentifier(context.database_name)} to ${quoteIdentifier(migratorRole)}, ${quoteIdentifier(appRole)}`,
      );
      await sql`alter role ${sql(appRole)} set statement_timeout = '30s'`;
      await sql`alter role ${sql(appRole)} set lock_timeout = '5s'`;
    });

    const applicationUrl = new URL(adminUrl);
    applicationUrl.username = appRole;
    applicationUrl.password = appPassword;
    const application = postgres(applicationUrl.toString(), {
      max: 1,
      connection: { statement_timeout: 30_000 },
    });
    try {
      const [checks] = await application<
        {
          application_objects_owned: number;
          can_create_schema_objects: boolean;
          restricted_role: boolean;
        }[]
      >`
        select
          not role.rolsuper
            and not role.rolcreatedb
            and not role.rolcreaterole
            and not role.rolreplication
            and not role.rolbypassrls as restricted_role,
          has_schema_privilege(current_user, 'public', 'create') as can_create_schema_objects,
          (
            select count(*)::int
            from pg_class relation
            join pg_namespace namespace on namespace.oid = relation.relnamespace
            where namespace.nspname = 'public'
              and pg_get_userbyid(relation.relowner) = current_user
          ) as application_objects_owned
        from pg_roles role
        where role.rolname = current_user
      `;
      if (
        !checks?.restricted_role ||
        checks.can_create_schema_objects ||
        checks.application_objects_owned !== 0
      ) {
        throw new Error("PostgreSQL runtime role verification failed");
      }

      for (const table of APPLICATION_TABLES) {
        const qualifiedName = `public.${quoteIdentifier(table)}`;
        const [privileges] = await application<
          { can_delete: boolean; can_insert: boolean; can_select: boolean; can_update: boolean }[]
        >`
          select
            has_table_privilege(current_user, ${qualifiedName}, 'select') as can_select,
            has_table_privilege(current_user, ${qualifiedName}, 'insert') as can_insert,
            has_table_privilege(current_user, ${qualifiedName}, 'update') as can_update,
            has_table_privilege(current_user, ${qualifiedName}, 'delete') as can_delete
        `;
        if (
          !privileges?.can_select ||
          !privileges.can_insert ||
          !privileges.can_update ||
          !privileges.can_delete
        ) {
          throw new Error(`Application role privileges are incomplete: ${qualifiedName}`);
        }
      }
      for (const sequence of APPLICATION_SEQUENCES) {
        const qualifiedName = `public.${quoteIdentifier(sequence)}`;
        const [privileges] = await application<{ can_select: boolean; can_use: boolean }[]>`
          select
            has_sequence_privilege(current_user, ${qualifiedName}, 'usage') as can_use,
            has_sequence_privilege(current_user, ${qualifiedName}, 'select') as can_select
        `;
        if (!privileges?.can_use || !privileges.can_select) {
          throw new Error(`Application role privileges are incomplete: ${qualifiedName}`);
        }
      }

      try {
        await application`create table public.__m9_runtime_role_must_not_create (id integer)`;
        throw new Error("Application role unexpectedly created a table");
      } catch (error) {
        if (!(error instanceof postgres.PostgresError) || error.code !== "42501") throw error;
      }
    } finally {
      await application.end();
    }

    return { appRole, databaseName: context.database_name, migratorRole };
  } finally {
    await admin.end();
  }
}

function requireEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const adminUrl = requireEnvironment("M9_POSTGRES_ADMIN_URL");
  const parsed = new URL(adminUrl);
  const isLocal = LOCAL_HOSTS.has(parsed.hostname);
  if (!isLocal) {
    if (
      !process.argv.includes("--allow-production") ||
      process.env.M9_PRODUCTION_CHANGE_ACK !== PRODUCTION_ACK
    ) {
      throw new Error(
        `Remote role bootstrap requires --allow-production and M9_PRODUCTION_CHANGE_ACK=${PRODUCTION_ACK}`,
      );
    }
  }

  const result = await configurePostgresRuntimeRoles({
    adminUrl,
    appPassword: requireEnvironment("M9_DB_APP_PASSWORD"),
    migratorPassword: requireEnvironment("M9_DB_MIGRATOR_PASSWORD"),
  });
  console.log(
    `PostgreSQL runtime boundary configured: database=${result.databaseName} migrator=${result.migratorRole} application=${result.appRole}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "PostgreSQL role bootstrap failed");
    process.exitCode = 1;
  });
}
