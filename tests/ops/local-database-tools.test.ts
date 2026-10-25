import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { devNull, tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { afterEach, expect, test } from "vitest";

import { assertLocalDatabaseUrl } from "../../scripts/local-database-environment";

const root = resolve(import.meta.dirname, "../..");
const loader = import.meta.resolve("tsx");
const localUrl = "postgresql://operator:NEVER_OUTPUT@127.0.0.1:5432/fixture";
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "oioi-db-inputs-"));
  directories.push(directory);
  const output = join(directory, "child.json");
  const binary = join(directory, "pnpm");
  writeFileSync(
    binary,
    `#!${process.execPath}
require(${JSON.stringify(resolve(root, "node_modules/dotenv/config.js"))});
require("node:fs").writeFileSync(process.env.DB_TOOL_RESULT, JSON.stringify({
  args: process.argv.slice(2), url: process.env.DATABASE_URL,
  unrelated: process.env.UNRELATED_FILE_VALUE,
  dotenvPath: process.env.DOTENV_CONFIG_PATH, override: process.env.DOTENV_CONFIG_OVERRIDE,
  dotenvKey: process.env.DOTENV_KEY,
}));
process.exit(Number(process.env.DB_TOOL_EXIT_CODE || 0));
`,
  );
  chmodSync(binary, 0o700);
  return {
    directory,
    output,
    run(tool: string, args: string[] = [], environment: NodeJS.ProcessEnv = {}) {
      return spawnSync(
        process.execPath,
        [
          "--import",
          loader,
          "--",
          resolve(root, "scripts/run-local-database-tool.ts"),
          tool,
          ...args,
        ],
        {
          cwd: directory,
          encoding: "utf8",
          env: {
            PATH: `${directory}${delimiter}${process.env.PATH}`,
            DB_TOOL_RESULT: output,
            ...environment,
          },
        },
      );
    },
  };
}

test.each(["migrate", "pull", "studio"])("%s uses the exact guarded process URL", (tool) => {
  const context = fixture();
  const result = context.run(tool, [], { DATABASE_URL: localUrl });
  expect(result.status, result.stderr).toBe(0);
  const child = JSON.parse(readFileSync(context.output, "utf8"));
  expect(child.url).toBe(localUrl);
  expect(child.args).toEqual(
    tool === "migrate"
      ? ["exec", "tsx", "scripts/run-drizzle-migrations.ts"]
      : ["exec", "drizzle-kit", tool],
  );
  expect(child.dotenvPath).toBe(devNull);
  expect(result.stdout + result.stderr).not.toContain("NEVER_OUTPUT");
});

test("UUID preparation and map arguments retain the local guard and reach only the migrator", () => {
  for (const args of [["--legacy-schema"], ["--uuid-map", "private-map.json"]]) {
    const context = fixture();
    const result = context.run("migrate", args, { DATABASE_URL: localUrl });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(context.output, "utf8")).args).toEqual([
      "exec",
      "tsx",
      "scripts/run-drizzle-migrations.ts",
      ...args,
    ]);
    expect(
      context.run("migrate", args, { DATABASE_URL: "postgresql://NEVER_OUTPUT@remote.invalid/db" })
        .status,
    ).toBe(1);
  }
});

test.each(["migrate", "pull", "studio"])(
  "%s uses only the selected file and blocks dotenv overrides",
  (tool) => {
    const context = fixture();
    const selected = join(context.directory, "console.env");
    const hidden = join(context.directory, "hidden.env");
    writeFileSync(selected, `DATABASE_URL=${localUrl}\nUNRELATED_FILE_VALUE=DO_NOT_COPY\n`);
    writeFileSync(hidden, "DATABASE_URL=postgresql://NEVER_OUTPUT@remote.invalid/hidden\n");
    const result = context.run(tool, ["--env-file", selected], {
      DOTENV_CONFIG_PATH: hidden,
      DOTENV_CONFIG_OVERRIDE: "true",
      DOTENV_KEY: "DO_NOT_COPY",
    });
    expect(result.status, result.stderr).toBe(0);
    const child = JSON.parse(readFileSync(context.output, "utf8"));
    expect(child.url).toBe(localUrl);
    expect(child.dotenvPath).toBe(devNull);
    for (const name of ["unrelated", "override", "dotenvKey"])
      expect(child).not.toHaveProperty(name);
    expect(result.stdout + result.stderr).not.toMatch(/NEVER_OUTPUT|DO_NOT_COPY/);
  },
);

test.each([
  undefined,
  "",
  "NOT_A_URL_NEVER_OUTPUT",
  "https://NEVER_OUTPUT@localhost/db",
  "postgresql://NEVER_OUTPUT@remote.invalid/db",
  `${localUrl}?host=remote.invalid`,
  `${localUrl}#`,
])("rejects invalid target %s without exposing credentials", (url) => {
  expect(() => assertLocalDatabaseUrl(url)).toThrow();
  try {
    assertLocalDatabaseUrl(url);
  } catch (error) {
    expect(String(error)).not.toContain("NEVER_OUTPUT");
  }
});

test("does not discover Web env and does not execute without explicit input", () => {
  const context = fixture();
  mkdirSync(join(context.directory, "apps/web"), { recursive: true });
  writeFileSync(join(context.directory, "apps/web/.env.local"), `DATABASE_URL=${localUrl}`);
  const result = context.run("migrate");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("DATABASE_URL is required");
  expect(existsSync(context.output)).toBe(false);
});

test.each(["migrate", "pull", "studio"])(
  "%s rejects remote input before executing a child",
  (tool) => {
    const context = fixture();
    const result = context.run(tool, [], {
      DATABASE_URL: "postgresql://NEVER_OUTPUT@remote.invalid/db",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("NEVER_OUTPUT");
    expect(existsSync(context.output)).toBe(false);
  },
);

test("accepts an explicit equals file option when process input agrees", () => {
  const context = fixture();
  const selected = join(context.directory, "selected.env");
  writeFileSync(selected, `DATABASE_URL=${localUrl}`);
  const result = context.run("migrate", [`--env-file=${selected}`], { DATABASE_URL: localUrl });
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(readFileSync(context.output, "utf8")).url).toBe(localUrl);
});

test("does not fall back from an unreadable or incomplete selected file", () => {
  const context = fixture();
  const selected = join(context.directory, "selected.env");
  for (const contents of [undefined, "UNRELATED_FILE_VALUE=DO_NOT_COPY"]) {
    if (contents) writeFileSync(selected, contents);
    const result = context.run("studio", ["--env-file", selected], { DATABASE_URL: localUrl });
    expect(result.status).toBe(1);
    expect(existsSync(context.output)).toBe(false);
    expect(result.stderr).not.toMatch(/NEVER_OUTPUT|DO_NOT_COPY/);
  }
});

test("rejects file/process conflicts and connection override flags before child execution", () => {
  const context = fixture();
  const selected = join(context.directory, "selected.env");
  writeFileSync(selected, `DATABASE_URL=${localUrl}`);
  for (const args of [
    ["--env-file", selected],
    ["--url", localUrl],
    ["--config", selected],
  ]) {
    const result = context.run("pull", args, {
      DATABASE_URL: localUrl.replace("fixture", "other"),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("NEVER_OUTPUT");
    expect(existsSync(context.output)).toBe(false);
  }
});

test("generate stays offline and child exit status is preserved", () => {
  const context = fixture();
  const result = context.run("generate", ["--name", "fixture"], {
    DATABASE_URL: "postgresql://NEVER_OUTPUT@remote.invalid/db",
    DB_TOOL_EXIT_CODE: "42",
  });
  expect(result.status).toBe(42);
  const child = JSON.parse(readFileSync(context.output, "utf8"));
  expect(child.args).toEqual(["exec", "drizzle-kit", "generate", "--name", "fixture"]);
  expect(child).not.toHaveProperty("url");
});
