import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import YAML from "yaml";

const root = path.resolve(import.meta.dirname, "../../../..");

function fingerprint(directory) {
  const hash = createHash("sha256");
  function visit(folder) {
    for (const entry of fs
      .readdirSync(folder, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(file);
      else {
        hash.update(
          path.relative(directory, file) + "\0" + (fs.lstatSync(file).mode & 0o777) + "\0",
        );
        hash.update(entry.isSymbolicLink() ? fs.readlinkSync(file) : fs.readFileSync(file));
      }
    }
  }
  visit(directory);
  return hash.digest("hex");
}

test("Docker pruning preserves target inputs and excludes unrelated sources and lock entries", (context) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "oioi-prune-policy-"));
  context.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, "source");
  const output = path.join(temporary, "output");
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  ).split("\0");
  for (const file of files.filter(
    (file) =>
      /^(?:apps|packages|tools)\//.test(file) ||
      [
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "turbo.json",
        ".gitignore",
      ].includes(file),
  )) {
    const destination = path.join(source, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const original = path.join(root, file);
    if (fs.lstatSync(original).isSymbolicLink())
      fs.symlinkSync(fs.readlinkSync(original), destination);
    else fs.copyFileSync(original, destination);
  }
  const version = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8"))
    .devDependencies.turbo;
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const binary = path.join(root, "node_modules/.bin/turbo");
  assert.equal(execFileSync(binary, ["--version"], { encoding: "utf8" }).trim(), version);
  const commands = path.join(temporary, "commands");
  fs.mkdirSync(commands);
  fs.writeFileSync(
    path.join(commands, "pnpm"),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$PRUNE_CALLS"\n',
    { mode: 0o755 },
  );
  for (const app of ["web", "console"]) {
    const dockerfile = fs.readFileSync(path.join(source, `apps/${app}/Dockerfile`), "utf8");
    assert.ok(dockerfile.includes(`pnpm dlx turbo@${version}`));
    const pruneCommand = dockerfile
      .split("FROM base AS dependencies")[0]
      .replace(/\\\n/g, " ")
      .split("\n")
      .find((line) => line.startsWith("RUN ") && line.includes(" prune "));
    assert.ok(pruneCommand);
    for (const scope of [app, app === "web" ? "console" : "web", "all"]) {
      const calls = path.join(temporary, `calls-${app}-${scope}`);
      const run = spawnSync("sh", ["-c", pruneCommand.slice(4)], {
        env: {
          ...env,
          PATH: commands + path.delimiter + env.PATH,
          BUILD_APP: scope,
          PRUNE_CALLS: calls,
        },
      });
      assert.equal(run.status, scope === app ? 0 : 1);
      assert.equal(fs.existsSync(calls), scope === app);
    }
  }
  execFileSync("git", ["init", "--quiet"], { cwd: source, env });

  function prune(scopes) {
    fs.rmSync(output, { recursive: true, force: true });
    execFileSync(
      binary,
      ["prune", ...scopes.map((app) => `@oioi-bwg/${app}`), "--docker", `--out-dir=${output}`],
      { cwd: source, env, stdio: "pipe" },
    );
    const full = path.join(output, "full");
    const lock = YAML.parse(fs.readFileSync(path.join(output, "json/pnpm-lock.yaml"), "utf8"));
    assert.deepEqual(
      Object.keys(lock.importers).sort(),
      [
        ".",
        ...scopes.map((app) => `apps/${app}`),
        "packages/config",
        "packages/contracts",
        "packages/server",
      ].sort(),
    );
    assert.ok(!fs.existsSync(path.join(full, "tools")));
    assert.ok(!fs.existsSync(path.join(full, "apps/sentry-slack-relay")));
    const tasks = JSON.parse(fs.readFileSync(path.join(full, "turbo.json"), "utf8")).tasks;
    assert.ok(Object.keys(tasks).every((name) => !name.startsWith("@oioi-bwg/repository-tools#")));
    return { install: fingerprint(path.join(output, "json")), source: fingerprint(full) };
  }
  const lockfile = path.join(source, "pnpm-lock.yaml");
  const originalLock = fs.readFileSync(lockfile);
  for (const app of ["web", "console"]) {
    const other = app === "web" ? "console" : "web";
    const baseline = prune([app]);
    assert.ok(!fs.existsSync(path.join(output, "full/apps", other)));
    const manifest = path.join(source, "apps/sentry-slack-relay/package.json");
    const originalManifest = fs.readFileSync(manifest);
    const irrelevant = path.join(source, `apps/${other}/src/instrumentation.ts`);
    const originalSource = fs.readFileSync(irrelevant);
    const addDependency = (owner, name) => {
      const data = JSON.parse(fs.readFileSync(owner, "utf8"));
      data.devDependencies[name] = "1.0.0";
      fs.writeFileSync(owner, JSON.stringify(data));
      const lock = YAML.parse(fs.readFileSync(lockfile, "utf8"));
      const directory = path.relative(source, path.dirname(owner));
      lock.importers[directory].devDependencies[name] = { specifier: "1.0.0", version: "1.0.0" };
      lock.packages[`${name}@1.0.0`] = {
        resolution: { integrity: "sha512-" + Buffer.alloc(64).toString("base64") },
      };
      lock.snapshots[`${name}@1.0.0`] = {};
      fs.writeFileSync(lockfile, YAML.stringify(lock));
    };
    try {
      fs.appendFileSync(irrelevant, "\n// unrelated app source\n");
      addDependency(manifest, "@oioi-prune-fixture/unrelated");
      assert.deepEqual(prune([app]), baseline);
    } finally {
      fs.writeFileSync(manifest, originalManifest);
      fs.writeFileSync(irrelevant, originalSource);
      fs.writeFileSync(lockfile, originalLock);
    }
    for (const file of [
      `apps/${app}/src/instrumentation.ts`,
      "packages/server/src/services/song-service.ts",
    ]) {
      const filename = path.join(source, file);
      const original = fs.readFileSync(filename);
      try {
        fs.appendFileSync(filename, "\n// required source\n");
        const changed = prune([app]);
        assert.equal(changed.install, baseline.install);
        assert.notEqual(changed.source, baseline.source);
      } finally {
        fs.writeFileSync(filename, original);
      }
    }
    const target = path.join(source, `apps/${app}/package.json`);
    const originalTarget = fs.readFileSync(target);
    try {
      addDependency(target, "@oioi-prune-fixture/required");
      assert.notEqual(prune([app]).install, baseline.install);
    } finally {
      fs.writeFileSync(target, originalTarget);
      fs.writeFileSync(lockfile, originalLock);
    }
  }
  prune(["web", "console"]);
});
