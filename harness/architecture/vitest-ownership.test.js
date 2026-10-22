import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createVitest } from "vitest/node";

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
