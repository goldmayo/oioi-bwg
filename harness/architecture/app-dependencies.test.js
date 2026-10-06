import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getSourceParts, resolveImportedParts } from "./import-path.js";

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

function readAppManifests(root = process.cwd()) {
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

test("shared mocks and source packages select and invalidate Web verification", (context) => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../..");
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "oioi-turbo-affected-"));
  context.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  for (const filename of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
    ".gitignore",
    "apps/web/package.json",
    "tests/mocks/server-only.ts",
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
    return JSON.parse(output).tasks;
  }

  const baseline = dryRun().filter(({ taskId }) => taskId.startsWith("@oioi-bwg/web#"));
  assert.deepEqual(dryRun(true), []);

  for (const filename of ["tests/mocks/server-only.ts", "packages/contracts/src/song.ts"]) {
    const changedFile = path.join(fixtureRoot, filename);
    const original = fs.readFileSync(changedFile);
    fs.appendFileSync(changedFile, "\n// shared input change\n");
    const affected = dryRun(true);
    for (const { taskId, hash } of baseline) {
      const selected = affected.find((task) => task.taskId === taskId);
      assert.ok(selected, `${filename} must select ${taskId}`);
      assert.notEqual(selected.hash, hash, `${filename} must invalidate ${taskId}`);
    }
    fs.writeFileSync(changedFile, original);
    assert.deepEqual(dryRun(true), []);
  }
});
