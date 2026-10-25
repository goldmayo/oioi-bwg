import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

import { getSourceParts, resolveImportedParts } from "@oioi-bwg/config/eslint/import-path";

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

function readAppManifests(root = path.resolve(import.meta.dirname, "../../../..")) {
  const appsDirectory = path.join(root, "apps");

  return fs
    .readdirSync(appsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(appsDirectory, entry.name, "package.json");

      if (!fs.existsSync(manifestPath)) return null;

      return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    })
    .filter(Boolean);
}

test("extracts source-relative parts from repository paths", () => {
  assert.deepEqual(getSourceParts("/repo/apps/web/src/features/auth/ui/form.tsx"), [
    "features",
    "auth",
    "ui",
    "form.tsx",
  ]);
  assert.equal(getSourceParts("/repo/apps/web/types/global.d.ts"), null);
});

test("resolves aliases and relative imports without workspace knowledge", () => {
  const source = ["features", "auth", "ui", "form.tsx"];

  assert.deepEqual(resolveImportedParts(source, "@/shared/lib/date"), ["shared", "lib", "date"]);
  assert.deepEqual(resolveImportedParts(source, "../model/use-auth"), [
    "features",
    "auth",
    "model",
    "use-auth",
  ]);
  assert.equal(resolveImportedParts(source, "react"), null);
});

test("app workspaces do not depend directly on other app workspaces", () => {
  const manifests = readAppManifests();
  const appNames = new Set(manifests.map((manifest) => manifest.name).filter(Boolean));

  for (const manifest of manifests) {
    for (const field of dependencyFields) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        assert.equal(
          appNames.has(dependency),
          false,
          `${manifest.name} must not depend directly on app workspace ${dependency}`,
        );
      }
    }
  }
});

test("config workspace owns its exports and imports without repository implementation dependencies", () => {
  const directory = path.resolve(import.meta.dirname, "../../../../packages/config");
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
  assert.equal(manifest.private, true);
  for (const target of Object.values(manifest.exports)) {
    assert.ok(target.startsWith("./"));
    assert.ok(fs.existsSync(path.join(directory, target)), target);
  }
  const declared = new Set(dependencyFields.flatMap((field) => Object.keys(manifest[field] ?? {})));
  function visit(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory() && !["node_modules", ".turbo"].includes(entry.name)) visit(filename);
      if (!entry.isFile() || !/\.[jt]s$/.test(entry.name)) continue;
      for (const { fileName: dependency } of ts.preProcessFile(fs.readFileSync(filename, "utf8"))
        .importedFiles) {
        if (dependency.startsWith("node:")) continue;
        if (dependency.startsWith(".")) {
          assert.ok(path.resolve(folder, dependency).startsWith(directory + path.sep), filename);
        } else {
          const name = dependency
            .split("/")
            .slice(0, dependency.startsWith("@") ? 2 : 1)
            .join("/");
          assert.ok(declared.has(name), `${filename} must declare ${name}`);
          assert.notEqual(name, "@oioi-bwg/web");
          assert.notEqual(name, "@oioi-bwg/console");
        }
      }
    }
  }
  visit(directory);
});

test("task inputs preserve required invalidation and unrelated cache hashes", (context) => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "oioi-turbo-affected-"));
  context.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  for (const filename of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
    "tsconfig.config.json",
    "eslint.config.ts",
    ".gitignore",
    "apps/web/package.json",
    "apps/console/package.json",
    "apps/sentry-slack-relay/package.json",
  ]) {
    const destination = path.join(fixtureRoot, filename);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(repositoryRoot, filename), destination);
  }
  fs.cpSync(path.join(repositoryRoot, "packages"), path.join(fixtureRoot, "packages"), {
    recursive: true,
    filter: (filename) =>
      !filename.split(path.sep).some((part) => ["node_modules", ".turbo"].includes(part)),
  });

  fs.cpSync(path.join(repositoryRoot, "tools"), path.join(fixtureRoot, "tools"), {
    recursive: true,
    filter: (filename) =>
      !filename.split(path.sep).some((part) => ["node_modules", ".turbo"].includes(part)),
  });

  // Git hooks export repository paths; fixture commands must discover their own repository.
  const fixtureEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  const commandOptions = {
    cwd: fixtureRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: fixtureEnvironment,
  };
  execFileSync("git", ["init", "--quiet"], commandOptions);
  execFileSync("git", ["add", "."], commandOptions);
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Architecture Harness",
      "-c",
      "user.email=harness@example.invalid",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "--quiet",
      "--message=테스트 기준 생성",
    ],
    commandOptions,
  );

  function dryRun(affected = false) {
    const output = execFileSync(
      path.join(repositoryRoot, "node_modules/.bin/turbo"),
      [
        "run",
        "type-check",
        "lint",
        "test",
        "build",
        "--dry=json",
        ...(affected ? ["--affected"] : []),
      ],
      {
        ...commandOptions,
        env: { ...fixtureEnvironment, TURBO_SCM_BASE: "HEAD", TURBO_SCM_HEAD: "HEAD" },
      },
    );
    const result = JSON.parse(output);
    assert.equal(result.globalCacheInputs.hashOfInternalDependencies, "");
    return result.tasks;
  }

  const tasks = dryRun();
  const baseline = tasks.filter(
    ({ command, resolvedTaskDefinition }) =>
      command !== "<NONEXISTENT>" && resolvedTaskDefinition.cache,
  );
  assert.equal(baseline.length, 22);
  for (const name of ["type-check", "lint"])
    assert.equal(
      tasks.find(({ taskId }) => taskId === `@oioi-bwg/repository-tools#${name}`)
        .resolvedTaskDefinition.cache,
      false,
    );
  assert.deepEqual(dryRun(true), []);

  const ids = (names, tasks) =>
    names.flatMap((name) => tasks.map((task) => `@oioi-bwg/${name}#${task}`));
  const apps = ["web", "console"];
  const products = [...apps, "server", "contracts", "sentry-slack-relay", "ui"];
  const appTypes = ids(apps, ["type-check"]);
  const appBuilds = ids(apps, ["build"]);
  const appLint = ids(apps, ["lint"]);
  const appUnit = ids(apps, ["test"]);
  const configChecks = ids(["config"], ["type-check", "lint"]);
  for (const directory of [
    "apps/web",
    "apps/console",
    "apps/sentry-slack-relay",
    "packages/server",
    "packages/contracts",
    "packages/ui",
    "packages/config",
  ]) {
    const task = baseline.find(
      ({ taskId }) => taskId === `@oioi-bwg/${directory.split("/")[1]}#type-check`,
    );
    for (const config of ["tsconfig.json", "tsconfig.config.json"]) {
      const filename = path.join(repositoryRoot, directory, config);
      if (!fs.existsSync(filename)) continue;
      const inputs = new Set();
      const parsed = ts.getParsedCommandLineOfConfigFile(
        filename,
        {},
        {
          ...ts.sys,
          readFile(file) {
            const value = ts.sys.readFile(file);
            if (value !== undefined) {
              const actual = fs.realpathSync(file);
              if (actual.startsWith(path.join(repositoryRoot, "packages/config/typescript/")))
                inputs.add(actual);
            }
            return value;
          },
          onUnRecoverableConfigFileDiagnostic: (error) => assert.fail(String(error.messageText)),
        },
      );
      const program = ts.createProgram(parsed.fileNames, parsed.options);
      for (const { fileName } of program.getSourceFiles())
        if (fileName.startsWith(path.join(repositoryRoot, "packages/config/")))
          inputs.add(fileName);
      for (const file of inputs) {
        const relative = path.relative(path.join(repositoryRoot, directory), file);
        assert.ok(Object.hasOwn(task.inputs, relative), `${directory} must hash ${relative}`);
      }
    }
  }
  const cases = [
    ["tsconfig.config.json", []],
    ["eslint.config.ts", []],
    ["tools/repository/harness/architecture/app-dependencies.test.js", []],
    ["packages/config/vitest/server-only.ts", [...appUnit, ...ids(["server"], ["test"])]],
    ["packages/config/vitest/client-only.ts", appUnit],
    [
      "packages/config/vitest/browser.js",
      [...appUnit, ...appTypes, ...ids(["ui"], ["type-check", "test"])],
    ],
    ["packages/config/vitest/browser.setup.ts", [...appUnit, ...ids(["ui"], ["test"])]],
    ["packages/config/vitest/postgres.js", appTypes],
    ["packages/config/next.ts", [...appBuilds, ...appTypes]],
    ["packages/config/sentry-build.ts", [...appBuilds, ...appTypes]],
    ["packages/config/steiger.ts", [...appLint, ...appTypes]],
    [
      "packages/config/typescript/base.json",
      [...ids(products, ["type-check"]), ...appLint, ...appBuilds],
    ],
    ["packages/config/typescript/next.json", [...appTypes, ...appLint, ...appBuilds]],
    ["packages/config/typescript/node.json", ids(products, ["type-check"])],
    ...["app", "base", "architecture-rule"].map((name) => [
      `packages/config/eslint/${name}.ts`,
      ids(products, ["type-check", "lint"]),
    ]),
    [
      "packages/contracts/src/song.ts",
      [
        ...ids(apps, ["type-check", "lint", "test", "build"]),
        ...ids(["server", "contracts"], ["type-check", "lint", "test"]),
      ],
    ],
    [
      "packages/server/src/services/song-service.ts",
      [
        ...ids(apps, ["type-check", "lint", "test", "build"]),
        ...ids(["server"], ["type-check", "lint", "test"]),
      ],
    ],
  ];
  for (const [filename, consumers] of cases) {
    const changedFile = path.join(fixtureRoot, filename);
    const original = fs.readFileSync(changedFile);
    try {
      fs.appendFileSync(changedFile, "\n// cache input change\n");
      const current = dryRun();
      const affected = dryRun(true);
      const expected = new Set([
        ...consumers,
        ...(filename.startsWith("packages/config/") ? configChecks : []),
      ]);
      for (const { taskId, hash } of baseline) {
        const task = current.find((task) => task.taskId === taskId);
        assert.equal(task.hash !== hash, expected.has(taskId), `${filename}: ${taskId}`);
        if (expected.has(taskId))
          assert.ok(
            affected.some((task) => task.taskId === taskId),
            `${filename} must select ${taskId}`,
          );
      }
    } finally {
      fs.writeFileSync(changedFile, original);
    }
    assert.deepEqual(dryRun(true), []);
  }
});
