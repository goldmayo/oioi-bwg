import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createVitest, parseCLI } from "vitest/node";

const root = path.resolve(import.meta.dirname, "../..");

for (const app of ["web", "console"]) {
  test(`${app} Vitest entry owns its source root and collects only its unit files`, async () => {
    const appRoot = path.join(root, "apps", app);
    // root cwd와 명시적 앱 config 조합에서도 앱 내부 경로가 유지되어야 한다.
    const ctx = await createVitest("test", {
      config: path.join(appRoot, "vitest.config.ts"),
      watch: false,
    });
    try {
      const specifications = await ctx.globTestSpecifications();
      const expected = fs
        .readdirSync(path.join(appRoot, "src"), { recursive: true })
        .filter((file) => /\.test\.tsx?$/.test(file))
        .map((file) => path.join(appRoot, "src", file))
        .sort();
      assert.ok(expected.length > 0);
      assert.deepEqual(specifications.map(({ moduleId }) => moduleId).sort(), expected);
      assert.equal(ctx.projects.length, 1);
      const project = ctx.projects[0];
      assert.equal(project.config.root, appRoot);
      assert.equal(project.config.environment, "jsdom");
      assert.equal(project.config.globals, true);
      assert.equal(project.config.css, true);
      assert.deepEqual(project.config.setupFiles, [
        path.join(root, "config/vitest/browser.setup.ts"),
      ]);
      assert.ok(project.config.exclude.includes("**/node_modules/**"));
      assert.ok(project.config.exclude.includes("**/.git/**"));
      for (const [name, target] of [
        ["@", path.join(appRoot, "src")],
        ["client-only", path.join(root, "tests/mocks/client-only.ts")],
        ["server-only", path.join(root, "tests/mocks/server-only.ts")],
      ]) {
        const alias = project.vite.config.resolve.alias.find(({ find }) => find === name);
        assert.equal(alias?.replacement, target);
      }
    } finally {
      await ctx.close();
    }
  });
}

test("root unit and coverage collect the Turbo workspace union with each workspace's settings", async () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const [runner, ...args] = scripts["test:unit:run"].split(" ");
  assert.equal(runner, "turbo");
  const { tasks } = JSON.parse(
    execFileSync(path.join(root, "node_modules/.bin/turbo"), [...args, "--dry=json"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    }),
  );

  function snapshot(project, specifications) {
    const settings = Object.fromEntries(
      [
        "environment",
        "globals",
        "css",
        "setupFiles",
        "include",
        "exclude",
        "pool",
        "isolate",
        "testTimeout",
        "hookTimeout",
        "fileParallelism",
        "maxWorkers",
      ].map((key) => [key, project.config[key]]),
    );
    return {
      ...settings,
      aliases: project.vite.config.resolve.alias,
      files: specifications
        .filter(({ project: owner }) => owner === project)
        .map(({ moduleId }) => moduleId)
        .sort(),
    };
  }

  const expected = new Map();
  for (const task of tasks.filter(({ task }) => task === "test")) {
    const { options, filter } = parseCLI(task.command);
    const ctx = await createVitest("test", {
      ...options,
      root: path.join(root, task.directory),
      watch: false,
    });
    try {
      const specifications = await ctx.globTestSpecifications(filter);
      assert.equal(ctx.projects.length, 1);
      const project = ctx.projects[0];
      assert.ok(specifications.length > 0);
      expected.set(project.config.root, snapshot(project, specifications));
    } finally {
      await ctx.close();
    }
  }
  assert.ok(expected.size > 0);

  for (const command of ["test:unit", "test:coverage"]) {
    const { options, filter } = parseCLI(scripts[command]);
    const ctx = await createVitest("test", { ...options, root, watch: false });
    try {
      const specifications = await ctx.globTestSpecifications(filter);
      assert.deepEqual(
        ctx.projects.map(({ config }) => config.root).sort(),
        [...expected.keys()].sort(),
      );
      for (const project of ctx.projects) {
        assert.deepEqual(snapshot(project, specifications), expected.get(project.config.root));
      }
      assert.equal(ctx.config.coverage.enabled, command === "test:coverage");
      assert.ok(
        specifications.every(({ moduleId }) => !moduleId.startsWith(path.join(root, "tests"))),
      );
    } finally {
      await ctx.close();
    }
  }
});
