import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createVitest, parseCLI } from "vitest/node";

const root = path.resolve(import.meta.dirname, "../../../..");

test("relay workspace owns its Node unit test without browser or application aliases", async () => {
  const directory = path.join(root, "apps/sentry-slack-relay");
  const ctx = await createVitest("test", {
    config: path.join(directory, "vitest.config.ts"),
    watch: false,
  });
  try {
    const files = await ctx.globTestSpecifications();
    assert.deepEqual(
      files.map(({ moduleId }) => moduleId),
      [path.join(directory, "tests/sentry-slack-relay.test.ts")],
    );
    assert.equal(ctx.projects.length, 1);
    const project = ctx.projects[0];
    assert.equal(project.config.root, directory);
    assert.equal(project.config.environment, "node");
    assert.equal(project.config.globals, false);
    assert.deepEqual(project.config.setupFiles, []);
    assert.ok(
      !project.vite.config.resolve.alias.some(({ find }) =>
        ["@", "server-only", "client-only"].includes(find),
      ),
    );
  } finally {
    await ctx.close();
  }
});

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
        path.join(root, "packages/config/vitest/browser.setup.ts"),
      ]);
      assert.ok(project.config.exclude.includes("**/node_modules/**"));
      assert.ok(project.config.exclude.includes("**/.git/**"));
      for (const [name, target] of [
        ["@", path.join(appRoot, "src")],
        ["client-only", path.join(root, "packages/config/vitest/client-only.ts")],
        ["server-only", path.join(root, "packages/config/vitest/server-only.ts")],
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
  for (const task of tasks.filter(
    ({ task, command }) => task === "test" && command !== "<NONEXISTENT>",
  )) {
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

test("PostgreSQL projects preserve serial Node execution and scope the Web adapter alias", async () => {
  const ctx = await createVitest("test", {
    config: path.join(root, "tests/integration/vitest.config.ts"),
    watch: false,
  });
  try {
    const specifications = await ctx.globTestSpecifications();
    const expected = ["tests/integration", "packages/server/tests/integration"]
      .flatMap((directory) =>
        fs
          .readdirSync(path.join(root, directory))
          .filter((file) => file.endsWith(".postgres.test.ts"))
          .map((file) => path.join(root, directory, file)),
      )
      .sort();
    assert.ok(expected.length > 0);
    assert.deepEqual(specifications.map(({ moduleId }) => moduleId).sort(), expected);
    assert.equal(ctx.config.fileParallelism, false);
    assert.equal(ctx.config.maxWorkers, 1);
    assert.deepEqual(ctx.projects.map(({ name }) => name).sort(), [
      "server-postgres",
      "web-postgres",
    ]);
    const foundation = path.join(root, "tests/integration/m7-foundation.postgres.test.ts");
    for (const project of ctx.projects) {
      const files = specifications
        .filter(({ project: owner }) => owner === project)
        .map(({ moduleId }) => moduleId)
        .sort();
      const isWeb = project.name === "web-postgres";
      assert.deepEqual(
        files,
        isWeb ? [foundation] : expected.filter((file) => file !== foundation),
      );
      assert.equal(project.config.root, root);
      assert.equal(project.config.environment, "node");
      assert.equal(project.config.globals, false);
      assert.deepEqual(project.config.setupFiles, []);
      assert.equal(project.config.pool, "forks");
      assert.equal(project.config.isolate, true);
      assert.equal(project.config.testTimeout, 30_000);
      assert.equal(project.config.hookTimeout, 30_000);
      assert.equal(project.config.sequence.concurrent, false);
      assert.ok(project.config.exclude.includes("**/node_modules/**"));
      assert.ok(project.config.exclude.includes("**/.git/**"));
      const aliases = project.vite.config.resolve.alias;
      assert.equal(
        aliases.find(({ find }) => find === "server-only")?.replacement,
        path.join(root, "packages/config/vitest/server-only.ts"),
      );
      assert.equal(
        aliases.some(({ find }) => find === "@"),
        isWeb,
      );
      const resolved = await project.vite.environments.ssr.pluginContainer.resolveId(
        "@/server/http/api-response",
        files[0],
      );
      assert.equal(
        resolved?.id ?? null,
        isWeb ? path.join(root, "apps/web/src/server/http/api-response.ts") : null,
      );
    }
  } finally {
    await ctx.close();
  }
});
