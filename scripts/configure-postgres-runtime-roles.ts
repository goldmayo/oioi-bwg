import { fileURLToPath } from "node:url";

import postgres, { type Sql } from "postgres";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PRODUCTION_ACK = "I_UNDERSTAND_THIS_CHANGES_DATABASE_ROLES";

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

      await sql`revoke all on schema public from public`;
      await sql`revoke create on schema public from ${sql(appRole)}`;
      await sql`grant usage on schema public to ${sql(appRole)}`;

      const relations = await sql<{ name: string; relation_kind: string; schema_name: string }[]>`
        select namespace.nspname as schema_name,
               relation.relname as name,
               relation.relkind as relation_kind
        from pg_class relation
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public'
          and relation.relkind in ('r', 'p', 'S', 'v', 'm', 'f')
          and (
            relation.relkind <> 'S'
            or not exists (
              select 1
              from pg_depend dependency
              where dependency.classid = 'pg_class'::regclass
                and dependency.objid = relation.oid
                and dependency.deptype in ('a', 'i')
            )
          )
        order by relation.relkind = 'S', relation.oid
      `;
      for (const relation of relations) {
        const objectType =
          relation.relation_kind === "S"
            ? "sequence"
            : relation.relation_kind === "v"
              ? "view"
              : relation.relation_kind === "m"
                ? "materialized view"
                : relation.relation_kind === "f"
                  ? "foreign table"
                  : "table";
        await sql.unsafe(
          `alter ${objectType} ${quoteIdentifier(relation.schema_name)}.${quoteIdentifier(relation.name)} owner to ${quoteIdentifier(migratorRole)}`,
        );
      }

      const enums = await sql<{ name: string; schema_name: string }[]>`
        select namespace.nspname as schema_name, type.typname as name
        from pg_type type
        join pg_namespace namespace on namespace.oid = type.typnamespace
        where namespace.nspname = 'public' and type.typtype = 'e'
      `;
      for (const enumType of enums) {
        await sql`
          alter type ${sql(enumType.schema_name)}.${sql(enumType.name)} owner to ${sql(migratorRole)}
        `;
      }

      await sql`alter schema public owner to ${sql(migratorRole)}`;
      await sql`revoke all on all tables in schema public from public`;
      await sql`revoke all on all sequences in schema public from public`;
      await sql`
        grant select, insert, update, delete on all tables in schema public to ${sql(appRole)}
      `;
      await sql`grant usage, select on all sequences in schema public to ${sql(appRole)}`;

      await sql`
        alter default privileges for role ${sql(migratorRole)} in schema public
        revoke all on tables from public
      `;
      await sql`
        alter default privileges for role ${sql(migratorRole)} in schema public
        revoke all on sequences from public
      `;
      await sql`
        alter default privileges for role ${sql(migratorRole)} in schema public
        grant select, insert, update, delete on tables to ${sql(appRole)}
      `;
      await sql`
        alter default privileges for role ${sql(migratorRole)} in schema public
        grant usage, select on sequences to ${sql(appRole)}
      `;

      await sql.unsafe(
        `revoke connect on database ${quoteIdentifier(context.database_name)} from public`,
      );
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
          missing_sequence_privileges: number;
          missing_table_privileges: number;
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
              and relation.relkind in ('r', 'p', 'v', 'm', 'f')
              and not (
                has_table_privilege(current_user, relation.oid, 'select')
                and has_table_privilege(current_user, relation.oid, 'insert')
                and has_table_privilege(current_user, relation.oid, 'update')
                and has_table_privilege(current_user, relation.oid, 'delete')
              )
          ) as missing_table_privileges,
          (
            select count(*)::int
            from pg_class relation
            join pg_namespace namespace on namespace.oid = relation.relnamespace
            where namespace.nspname = 'public'
              and relation.relkind = 'S'
              and not has_sequence_privilege(current_user, relation.oid, 'usage')
          ) as missing_sequence_privileges,
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
        checks.missing_table_privileges !== 0 ||
        checks.missing_sequence_privileges !== 0 ||
        checks.application_objects_owned !== 0
      ) {
        throw new Error("PostgreSQL runtime role verification failed");
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
