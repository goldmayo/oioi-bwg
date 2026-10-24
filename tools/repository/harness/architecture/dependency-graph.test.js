import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cruise } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";

import { dependencyOptions, workspaceDependencyErrors } from "@oioi-bwg/config/dependencies";

const owners = [
  "apps/web",
  "apps/console",
  "packages/server",
  "packages/contracts",
  "packages/config",
  "tools/repository",
].map((directory) => ({
  directory,
  name:
    directory === "tools/repository"
      ? "@oioi-bwg/repository-tools"
      : "@oioi-bwg/" + directory.split("/")[1],
  exports: {
    "./public": directory === "packages/config" ? "./public.ts" : "./src/public.ts",
    ...(directory === "tools/repository" ? { "./eslint": "./eslint.config.ts" } : {}),
  },
  dependencies: Object.fromEntries(
    ["server", "contracts", "config"].map((name) => ["@oioi-bwg/" + name, "workspace:*"]),
  ),
}));

const cases = [
  [
    "registered root tooling",
    "eslint.config.ts",
    'export * from "./tools/repository/eslint.config.ts";',
    false,
  ],
  [
    "private root tooling",
    "eslint.config.ts",
    'export * from "./tools/repository/private.ts";',
    true,
  ],
  [
    "bare root tooling",
    "eslint.config.ts",
    'export * from "@oioi-bwg/repository-tools/eslint";',
    true,
  ],
  [
    "unregistered root tooling",
    "tests/ops/probe.test.ts",
    'export * from "../../tools/repository/eslint.config.ts";',
    true,
  ],
  [
    "tooling test to app",
    "tools/repository/probe.test.ts",
    'export * from "../../apps/web/src/shared/value";',
    true,
  ],
  [
    "declared product tooling",
    "apps/web/src/shared/probe.ts",
    'export * from "@oioi-bwg/repository-tools/public";',
    true,
  ],
  [
    "Sentry runtime tooling",
    "apps/web/sentry.server.config.ts",
    'export * from "@oioi-bwg/config/public";',
    true,
  ],
  [
    "runtime cycle",
    "apps/web/src/a.ts",
    'import { b } from "./b"; export const a = () => b;',
    true,
  ],
  [
    "type cycle",
    "apps/web/src/a.ts",
    'import type { B } from "./b"; export type A = { b: B };',
    false,
  ],
  [
    "public contract",
    "apps/web/src/probe.ts",
    'export { value } from "@oioi-bwg/contracts/public";',
    false,
  ],
  ["app alias", "apps/web/src/probe.ts", 'export { value } from "@/shared/value";', false],
  [
    "package test to app",
    "packages/server/tests/probe.test.ts",
    'export * from "../../../apps/web/src/shared/value";',
    true,
  ],
  [
    "contract test to app",
    "packages/contracts/src/probe.test.ts",
    'export * from "../../../apps/web/src/shared/value";',
    true,
  ],
  [
    "app config to other app",
    "apps/web/vitest.config.ts",
    'export * from "../console/src/shared/value";',
    true,
  ],
  [
    "client relative core",
    "apps/web/src/app/client.ts",
    '"use client"; export * from "../../../../packages/server/src/public";',
    true,
  ],
  [
    "runtime tooling",
    "apps/web/src/shared/probe.ts",
    'export * from "@oioi-bwg/config/public";',
    true,
  ],
  ["contract platform", "packages/contracts/src/probe.ts", 'export * from "node:fs";', true],
  [
    "private package entry",
    "apps/web/src/probe.ts",
    'export * from "@oioi-bwg/contracts/src/public";',
    true,
  ],
  [
    "type reverse import",
    "packages/server/src/probe.ts",
    'export type { Value } from "../../../apps/web/src/shared/value";',
    true,
  ],
  [
    "dynamic reverse import",
    "packages/server/src/probe.ts",
    'export const load = () => import("../../../apps/web/src/shared/value");',
    true,
  ],
  ["package own test", "packages/contracts/src/probe.test.ts", 'export * from "./public";', false],
  [
    "contracts relative config",
    "packages/contracts/src/probe.ts",
    'export * from "../../config/public";',
    true,
  ],
  [
    "undeclared package",
    "apps/web/src/probe.ts",
    'export * from "@oioi-bwg/contracts/public";',
    true,
  ],
  [
    "root test app import",
    "tests/ops/probe.test.ts",
    'export * from "../../apps/web/src/shared/value";',
    true,
  ],
  [
    "foundation adapter",
    "tests/integration/m7-foundation.postgres.test.ts",
    'export * from "@/server/http/api-response";',
    false,
  ],
  [
    "foundation foreign app",
    "tests/integration/m7-foundation.postgres.test.ts",
    'export * from "../../apps/console/src/shared/value";',
    true,
  ],
];

test("resolved graphs enforce boundaries in source, config, tests and package exports", async () => {
  const previous = process.cwd();
  try {
    for (const [name, filename, source, rejected] of cases) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "oioi-dependency-policy-"));
      try {
        const write = (file, content) => {
          fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
          fs.writeFileSync(path.join(root, file), content);
        };
        for (const owner of owners) {
          const entry = owner.directory === "packages/config" ? "public.ts" : "src/public.ts";
          write(
            owner.directory + "/package.json",
            JSON.stringify({
              name: owner.name,
              type: "module",
              exports: owner.exports,
            }),
          );
          write(owner.directory + "/" + entry, "export const value = 1;");
          const link = path.join(root, "node_modules", owner.name);
          fs.mkdirSync(path.dirname(link), { recursive: true });
          fs.symlinkSync(path.join(root, owner.directory), link);
        }
        write(
          "apps/web/src/shared/value.ts",
          "export const value = 1; export type Value = number;",
        );
        write("apps/console/src/shared/value.ts", "export const value = 2;");
        write(
          "apps/web/tsconfig.json",
          JSON.stringify({
            compilerOptions: { paths: { "@/*": ["./src/*"] }, module: "ESNext" },
            include: ["src"],
          }),
        );
        write("tools/repository/eslint.config.ts", "export const value = 1;");
        write("tools/repository/private.ts", "export const value = 1;");
        write("apps/web/src/server/http/api-response.ts", "export const value = 1;");
        write(filename, source);
        const descriptors =
          name === "undeclared package"
            ? owners.map((owner) =>
                owner.directory === "apps/web" ? { ...owner, dependencies: {} } : owner,
              )
            : name === "declared product tooling"
              ? owners.map((owner) =>
                  owner.directory === "apps/web"
                    ? {
                        ...owner,
                        dependencies: {
                          ...owner.dependencies,
                          "@oioi-bwg/repository-tools": "workspace:*",
                        },
                      }
                    : owner,
                )
              : owners;
        if (name === "runtime cycle")
          write("apps/web/src/b.ts", 'import { a } from "./a"; export const b = () => a;');
        if (name === "type cycle")
          write("apps/web/src/b.ts", 'import type { A } from "./a"; export type B = { a: A };');
        process.chdir(path.join(root, "apps/web"));
        const config = path.join(root, "apps/web/tsconfig.json");
        const result = await cruise(
          [filename],
          dependencyOptions(root, config, owners, ["apps/web/src/app/client.ts"]),
          {},
          { tsConfig: extractTSConfig(config) },
        );
        assert.notEqual(typeof result.output, "string");
        const count =
          result.output.summary.error +
          workspaceDependencyErrors(descriptors, result.output.modules).length;
        assert.equal(count > 0, rejected, name);
        if (name === "declared product tooling")
          assert.ok(
            result.output.summary.violations.some(({ rule }) => rule.name === "runtime-tooling"),
          );
        if (name === "client relative core")
          assert.ok(
            result.output.summary.violations.some(({ rule }) => rule.name === "client-server-core"),
          );
        if (name === "runtime cycle")
          assert.ok(
            result.output.summary.violations.some(({ rule }) => rule.name === "runtime-circular"),
          );
        if (name === "type cycle")
          assert.ok(
            result.output.summary.violations.some(
              ({ rule }) => rule.name === "type-involved-circular",
            ),
          );
      } finally {
        process.chdir(previous);
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
    assert.ok(
      workspaceDependencyErrors([
        { ...owners[0], dependencies: { "@oioi-bwg/contracts": "^1.0.0" } },
        owners[3],
      ]).some((message) => message.includes("workspace:")),
    );
    assert.ok(
      workspaceDependencyErrors([
        { ...owners[0], dependencies: { "@oioi-bwg/console": "workspace:*" } },
        owners[1],
      ]).length,
    );
  } finally {
    process.chdir(previous);
  }
});
