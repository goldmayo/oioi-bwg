import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";

import postgres from "postgres";

import { configurePostgresRuntimeRoles } from "./configure-postgres-runtime-roles";

const ADMIN_URL_ENV = "M7_TEST_POSTGRES_ADMIN_URL";
const DATABASE_PREFIX = "oioi_m7_test_";
const LOCAL_ADMIN_URL = "postgresql://oioibawige:oioibawige_dev_only@127.0.0.1:5432/postgres";
const TEST_AUTH_SECRET = "m7-postgres-integration-test-only";

let activeChild: ChildProcess | undefined;
let interruptedBy: NodeJS.Signals | undefined;

function parseArguments() {
  const arguments_ = process.argv.slice(2);

  if (arguments_.length === 0) return { local: false };
  if (arguments_.length === 1 && arguments_[0] === "--local") return { local: true };

  throw new Error("Usage: run-postgres-integration-tests.ts [--local]");
}

function resolveAdminUrl(local: boolean) {
  if (local) return new URL(LOCAL_ADMIN_URL);

  const value = process.env[ADMIN_URL_ENV];
  if (!value) throw new Error(`${ADMIN_URL_ENV} is required unless --local is used`);
  return new URL(value);
}

function assertSafeAdminUrl(url: URL) {
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw new Error("PostgreSQL test admin URL must use the postgres protocol");
  }
  if (!new Set(["localhost", "127.0.0.1"]).has(url.hostname)) {
    throw new Error("PostgreSQL test admin URL must target localhost");
  }
  if (url.pathname !== "/postgres") {
    throw new Error("PostgreSQL test admin URL must target the postgres maintenance database");
  }
}

function createDatabaseName() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const name = `${DATABASE_PREFIX}${Date.now()}_${suffix}`;

  if (!/^oioi_m7_test_[a-z0-9_]+$/.test(name)) {
    throw new Error("Generated an unsafe PostgreSQL test database name");
  }

  return name;
}

function runCommand(command: string, arguments_: string[], environment: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, arguments_, {
      env: environment,
      stdio: "inherit",
    });
    activeChild = child;

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      activeChild = undefined;
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${command} terminated by ${signal}`
            : `${command} exited with code ${code ?? "unknown"}`,
        ),
      );
    });
  });
}

function quoteIdentifier(identifier: string) {
  if (!/^oioi_m7_test_[a-z0-9_]+$/.test(identifier)) {
    throw new Error("Refusing an unsafe PostgreSQL identifier");
  }
  return `"${identifier}"`;
}

async function main() {
  const { local } = parseArguments();
  const adminUrl = resolveAdminUrl(local);
  assertSafeAdminUrl(adminUrl);

  const admin = postgres(adminUrl.toString(), {
    max: 1,
    connection: { statement_timeout: 15_000 },
  });
  const databaseName = createDatabaseName();
  const databaseIdentifier = quoteIdentifier(databaseName);
  let databaseCreated = false;
  let executionError: unknown;
  let runtimeAppRole: string | undefined;
  let runtimeMigratorRole: string | undefined;
  const cleanupErrors: string[] = [];

  const handleSignal = (signal: NodeJS.Signals) => {
    interruptedBy ??= signal;
    activeChild?.kill(signal);
  };
  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  try {
    const [version] = await admin<{ server_version_num: string }[]>`show server_version_num`;
    const majorVersion = Math.floor(Number(version?.server_version_num) / 10_000);
    if (majorVersion !== 17) {
      throw new Error(`PostgreSQL 17 is required; detected major ${majorVersion}`);
    }
    console.log("PostgreSQL integration server: major 17");

    await admin.unsafe(`create database ${databaseIdentifier}`);
    databaseCreated = true;
    console.log(`PostgreSQL integration database created: ${databaseName}`);

    const databaseUrl = new URL(adminUrl);
    databaseUrl.pathname = `/${databaseName}`;
    const childEnvironment = { ...process.env };
    delete childEnvironment[ADMIN_URL_ENV];
    Object.assign(childEnvironment, {
      AUTH_SECRET: TEST_AUTH_SECRET,
      DATABASE_URL: databaseUrl.toString(),
      NODE_ENV: "test",
    });

    const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    await runCommand(packageManager, ["db:migrate"], childEnvironment);

    const bootstrapFixture = postgres(databaseUrl.toString(), {
      max: 1,
      connection: { statement_timeout: 15_000 },
    });
    let drizzleSchemaOwner = "";
    let publicSchemaOwner = "";
    try {
      await bootstrapFixture`create extension if not exists pg_stat_statements`;
      await bootstrapFixture`
        create table public.m9_host_owned_fixture (id bigserial primary key, note text)
      `;
      const schemaOwners = await bootstrapFixture<{ name: string; owner: string }[]>`
        select namespace.nspname as name, pg_get_userbyid(namespace.nspowner) as owner
        from pg_namespace namespace
        where namespace.nspname in ('public', 'drizzle')
      `;
      publicSchemaOwner = schemaOwners.find(({ name }) => name === "public")?.owner ?? "";
      drizzleSchemaOwner = schemaOwners.find(({ name }) => name === "drizzle")?.owner ?? "";
      if (!publicSchemaOwner || !drizzleSchemaOwner) {
        throw new Error("Could not capture PostgreSQL schema ownership before role bootstrap");
      }
    } finally {
      await bootstrapFixture.end();
    }

    const roleSuffix = databaseName.replace(DATABASE_PREFIX, "").slice(-24);
    runtimeAppRole = `m9_app_${roleSuffix}`;
    runtimeMigratorRole = `m9_migrator_${roleSuffix}`;
    const runtimePassword = `M9-local-${roleSuffix}`;
    await configurePostgresRuntimeRoles({
      adminUrl: databaseUrl.toString(),
      appPassword: runtimePassword,
      appRole: runtimeAppRole,
      migratorPassword: `${runtimePassword}-migrator`,
      migratorRole: runtimeMigratorRole,
    });

    const migratorUrl = new URL(databaseUrl);
    migratorUrl.username = runtimeMigratorRole;
    migratorUrl.password = `${runtimePassword}-migrator`;
    Object.assign(childEnvironment, { DATABASE_URL: migratorUrl.toString() });
    await runCommand(packageManager, ["db:migrate"], childEnvironment);

    const runtimeUrl = new URL(databaseUrl);
    runtimeUrl.username = runtimeAppRole;
    runtimeUrl.password = runtimePassword;
    Object.assign(childEnvironment, {
      DATABASE_URL: runtimeUrl.toString(),
      M9_TEST_ADMIN_ROLE: adminUrl.username,
      M9_TEST_DRIZZLE_SCHEMA_OWNER: drizzleSchemaOwner,
      M9_TEST_PUBLIC_SCHEMA_OWNER: publicSchemaOwner,
      M9_TEST_RUNTIME_APP_ROLE: runtimeAppRole,
      M9_TEST_RUNTIME_MIGRATOR_ROLE: runtimeMigratorRole,
      M7_TEST_POSTGRES_VERIFICATION_URL: databaseUrl.toString(),
    });
    await runCommand(
      packageManager,
      ["exec", "vitest", "run", "--config", "vitest.postgres.config.ts", "--reporter=verbose"],
      childEnvironment,
    );
  } catch (error) {
    executionError = error;
  } finally {
    if (databaseCreated) {
      try {
        const [connections] = await admin<{ count: number }[]>`
          select count(*)::int as count
          from pg_stat_activity
          where datname = ${databaseName}
        `;
        const [locks] = await admin<{ count: number }[]>`
          select count(*)::int as count
          from pg_locks locks
          join pg_database databases on databases.oid = locks.database
          where locks.locktype = 'advisory'
            and databases.datname = ${databaseName}
        `;

        if ((connections?.count ?? 0) !== 0) {
          cleanupErrors.push(
            `temporary database retained ${connections?.count ?? 0} connection(s)`,
          );
        }
        if ((locks?.count ?? 0) !== 0) {
          cleanupErrors.push(`temporary database retained ${locks?.count ?? 0} advisory lock(s)`);
        }

        if (cleanupErrors.length === 0) {
          await admin.unsafe(`drop database ${databaseIdentifier}`);
        } else {
          await admin.unsafe(`drop database ${databaseIdentifier} with (force)`);
        }

        const [remaining] = await admin<{ count: number }[]>`
          select count(*)::int as count
          from pg_database
          where datname = ${databaseName}
        `;
        if ((remaining?.count ?? 0) !== 0) {
          cleanupErrors.push("temporary database remained in the PostgreSQL catalog");
        }
      } catch {
        cleanupErrors.push("temporary database drop or catalog verification failed");
        try {
          await admin.unsafe(`drop database ${databaseIdentifier} with (force)`);
        } catch {
          cleanupErrors.push("temporary database best-effort force drop failed");
        }
      }
    }

    for (const role of [runtimeAppRole, runtimeMigratorRole]) {
      if (!role) continue;
      try {
        await admin`drop role if exists ${admin(role)}`;
      } catch {
        cleanupErrors.push(`temporary PostgreSQL role cleanup failed: ${role}`);
      }
    }

    try {
      await admin.end();
    } catch {
      cleanupErrors.push("PostgreSQL admin connection close failed");
    }
    process.removeListener("SIGINT", handleSignal);
    process.removeListener("SIGTERM", handleSignal);
  }

  if (databaseCreated && cleanupErrors.length === 0) {
    console.log(
      `PostgreSQL integration cleanup: 0 connections, 0 advisory locks, dropped ${databaseName}`,
    );
  }
  if (cleanupErrors.length > 0) {
    for (const message of cleanupErrors) console.error(`PostgreSQL cleanup failure: ${message}`);
    throw new Error("PostgreSQL integration cleanup failed");
  }
  if (executionError) throw executionError;
  if (interruptedBy) throw new Error(`PostgreSQL integration interrupted by ${interruptedBy}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown PostgreSQL integration failure";
  console.error(`PostgreSQL integration failed: ${message}`);
  process.exitCode = 1;
});
