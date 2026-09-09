import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const script = resolve("ops/oci/deploy-release.sh");
const temporaryRoots: string[] = [];

async function fixture() {
  const root = await import("node:fs/promises").then(({ mkdtemp }) =>
    mkdtemp(join(tmpdir(), "oioi-m9-deploy-")),
  );
  temporaryRoots.push(root);
  const runtime = join(root, "runtime");
  const config = join(root, "config");
  const binaries = join(root, "bin");
  await Promise.all([
    mkdir(join(runtime, "deploy"), { recursive: true }),
    mkdir(config),
    mkdir(binaries),
  ]);

  await writeFile(join(runtime, "compose.yml"), "services:\n  app:\n    image: ${APP_IMAGE}\n");
  await writeFile(join(config, "runtime-public.env"), "NEXT_PUBLIC_APP_ENV=staging\n");
  await writeFile(
    join(config, "runtime-secrets.env"),
    "DB_APP_PASSWORD=ocid1.vaultsecret.test.db-secret\nAUTH_SECRET=ocid1.vaultsecret.test.auth-secret\n",
  );
  await writeFile(
    join(config, "deploy.conf"),
    [
      "IMAGE_REPOSITORY=icn.ocir.io/example/oioi-bwg",
      "POSTGRES_NETWORK=postgres-network",
      "DATABASE_HOST=postgres",
      "DATABASE_PORT=5432",
      "DATABASE_NAME=oioibawige",
      "DATABASE_USER=oioi_app",
      "APP_BIND_ADDRESS=127.0.0.1",
      "APP_PORT=3000",
      'SMOKE_PATHS="/ /api/auth/session"',
      'REQUIRED_RUNTIME_KEYS="DATABASE_URL AUTH_SECRET"',
      "",
    ].join("\n"),
  );
  await chmod(join(config, "deploy.conf"), 0o600);
  await chmod(join(config, "runtime-secrets.env"), 0o600);

  await writeFile(
    join(binaries, "oci"),
    `#!/usr/bin/env bash
if [[ "$*" == *"db-secret"* ]]; then
  printf 'cEBzc3dvcmQ='
else
  printf 'YXV0aC10ZXN0LXNlY3JldA=='
fi
`,
  );
  await writeFile(
    join(binaries, "docker"),
    `#!/usr/bin/env bash
printf '%s|%s\n' "\${APP_IMAGE:-}" "$*" >> "\${MOCK_DOCKER_LOG}"
if [[ "$*" == *" compose "* || "$1" == "compose" ]]; then
  if [[ "$*" == *" up "* && "\${MOCK_FAIL_MODE:-}" == "all" ]]; then exit 1; fi
  if [[ "$*" == *" up "* && -n "\${MOCK_FAIL_DIGEST:-}" && "\${APP_IMAGE:-}" == *"\${MOCK_FAIL_DIGEST}"* ]]; then exit 1; fi
fi
`,
  );
  await writeFile(join(binaries, "curl"), "#!/usr/bin/env bash\nexit 0\n");
  await Promise.all(["oci", "docker", "curl"].map((name) => chmod(join(binaries, name), 0o755)));

  return { binaries, config, root, runtime };
}

function execute(
  paths: Awaited<ReturnType<typeof fixture>>,
  target: string,
  extra: NodeJS.ProcessEnv = {},
  additionalArguments: string[] = [],
) {
  return spawnSync("bash", [script, target, ...additionalArguments], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...extra,
      M9_DEPLOY_TEST_MODE: "1",
      MOCK_DOCKER_LOG: join(paths.root, "docker.log"),
      OIOI_APPLICATION_ENV: join(paths.runtime, "app.env"),
      OIOI_COMPOSE_FILE: join(paths.runtime, "compose.yml"),
      OIOI_CONFIG_ROOT: paths.config,
      OIOI_RUNTIME_ROOT: paths.runtime,
      OIOI_STATE_DIR: join(paths.runtime, "deploy"),
      PATH: `${paths.binaries}:${process.env.PATH}`,
    },
  });
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("OCI release deployment", () => {
  test("rejects additional arguments allowed by a portable sudoers wildcard", async () => {
    const paths = await fixture();

    const result = execute(paths, digest("a"), {}, ["unexpected"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"event":"exactly_one_digest_required"');
  });

  test("promotes an immutable digest and atomically shifts release state", async () => {
    const paths = await fixture();
    const previous = digest("a");
    const candidate = digest("b");
    await writeFile(join(paths.runtime, "deploy", "current"), `${previous}\n`);
    await writeFile(join(paths.runtime, "app.env"), "AUTH_SECRET=previous\n", { mode: 0o600 });

    const result = execute(paths, candidate);

    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(join(paths.runtime, "deploy", "current"), "utf8")).toBe(`${candidate}\n`);
    expect(await readFile(join(paths.runtime, "deploy", "previous"), "utf8")).toBe(`${previous}\n`);
    const applicationEnvironment = await readFile(join(paths.runtime, "app.env"), "utf8");
    expect(applicationEnvironment).toContain("AUTH_SECRET=auth-test-secret");
    expect(applicationEnvironment).toContain(
      "DATABASE_URL=postgresql://oioi_app:p%40ssword@postgres:5432/oioibawige",
    );
    expect((await stat(join(paths.runtime, "app.env"))).mode & 0o777).toBe(0o600);
    expect(result.stdout).toContain('"event":"deployment_succeeded"');
    expect(`${result.stdout}${result.stderr}`).not.toContain("auth-test-secret");
  });

  test("restores the previous digest and env after a candidate failure", async () => {
    const paths = await fixture();
    const current = digest("c");
    const candidate = digest("d");
    await writeFile(join(paths.runtime, "deploy", "current"), `${current}\n`);
    await writeFile(join(paths.runtime, "app.env"), "AUTH_SECRET=previous\n", { mode: 0o600 });

    const result = execute(paths, candidate, { MOCK_FAIL_DIGEST: candidate });

    expect(result.status).toBe(20);
    expect(result.stderr).toContain('"event":"candidate_failed"');
    expect(result.stderr).toContain('"event":"rollback_succeeded"');
    expect(await readFile(join(paths.runtime, "deploy", "current"), "utf8")).toBe(`${current}\n`);
    expect(await readFile(join(paths.runtime, "app.env"), "utf8")).toBe("AUTH_SECRET=previous\n");
    expect(await readFile(join(paths.root, "docker.log"), "utf8")).toContain(
      `icn.ocir.io/example/oioi-bwg@${current}`,
    );
  });

  test("reports a distinct critical state when rollback also fails", async () => {
    const paths = await fixture();
    const current = digest("e");
    await writeFile(join(paths.runtime, "deploy", "current"), `${current}\n`);
    await writeFile(join(paths.runtime, "app.env"), "AUTH_SECRET=previous\n", { mode: 0o600 });

    const result = execute(paths, digest("f"), { MOCK_FAIL_MODE: "all" });

    expect(result.status).toBe(21);
    expect(result.stderr).toContain('"event":"rollback_failed"');
    expect(await readFile(join(paths.runtime, "deploy", "current"), "utf8")).toBe(`${current}\n`);
  });
});
