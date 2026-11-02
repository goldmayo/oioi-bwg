import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ESLint } from "eslint";

import { createOxlintConfig, transferredTypeScriptRules } from "@oioi-bwg/config/oxlint";

const root = path.resolve(import.meta.dirname, "../../../..");
const requireConfig = createRequire(path.join(root, "packages/config/package.json"));
const tseslint = requireConfig("typescript-eslint");
const nativeBin = path.join(root, "node_modules/oxlint/bin/oxlint");

function runNative(cwd, ...args) {
  const result = spawnSync(process.execPath, [nativeBin, ...args], { cwd, encoding: "utf8" });
  assert.equal(result.error, undefined);
  assert.ok([0, 1].includes(result.status), result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function signature(messages, ruleName) {
  return messages
    .filter(({ rule }) => rule === ruleName)
    .map(({ severity }) => severity)
    .sort();
}

test("native allowlist preserves the original TypeScript checks and exceptions", async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "oioi-native-lint-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const nativeConfig = createOxlintConfig();
  const configPath = path.join(directory, ".oxlintrc.json");
  fs.writeFileSync(configPath, JSON.stringify(nativeConfig));
  const original = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx}"],
        languageOptions: { parser: tseslint.parser },
        plugins: { "@typescript-eslint": tseslint.plugin },
        rules: Object.fromEntries(
          transferredTypeScriptRules.map((rule) => [`@typescript-eslint/${rule}`, "error"]),
        ),
      },
    ],
  });
  const cases = {
    "ban-ts-comment": [
      "// @ts-ignore\nexport const value = 1;",
      "// @ts-expect-error: reason\nexport const value = 1;",
    ],
    "no-duplicate-enum-values": [
      "export enum Choice { A = 1, B = 1 }",
      "export enum Choice { A = 1, B = 2 }",
    ],
    "no-empty-object-type": ["export type Empty = {};", "export type Value = object;"],
    "no-explicit-any": ["export type Value = any;", "export type Value = unknown;"],
    "no-misused-new": [
      "export interface Widget { new(): Widget; }",
      "export interface Widget { new(): object; }",
    ],
    "no-namespace": [
      "namespace Helpers { export const n = 1; }",
      "export const Helpers = { n: 1 };",
    ],
    "no-non-null-asserted-optional-chain": [
      "export const n = object?.value!;",
      "export const n = object?.value;",
    ],
    "no-require-imports": [
      "export const fs = require('node:fs');",
      "import fs from 'node:fs'; export { fs };",
    ],
    "no-this-alias": [
      "export function capture() { const self = this; return self; }",
      "export function capture() { const { value } = this; return value; }",
    ],
    "no-unnecessary-type-constraint": [
      "export const id = <T extends unknown>(value: T) => value;",
      "export const id = <T>(value: T) => value;",
    ],
    "no-unsafe-function-type": [
      "export type Call = Function;",
      "export type Call = () => unknown;",
    ],
    "triple-slash-reference": [
      "/// <reference path='./types.d.ts' />\nexport const n = 1;",
      "/// <reference lib='esnext' />\nexport const n = 1;",
    ],
  };
  assert.deepEqual(Object.keys(cases).sort(), [...transferredTypeScriptRules].sort());
  for (const [rule, sources] of Object.entries(cases)) {
    for (const [index, source] of sources.entries()) {
      const filename = path.join(directory, `${rule}-${index}.ts`);
      fs.writeFileSync(filename, source);
      const [baseline] = await original.lintFiles([filename]);
      const native = runNative(directory, "--config", configPath, "--format=json", filename);
      const expected = baseline.messages.map(({ ruleId, severity }) => ({
        rule: ruleId?.replace("@typescript-eslint/", ""),
        severity,
      }));
      const actual = native.diagnostics.map(({ code, severity }) => ({
        rule: code.replace(/^typescript\((.*)\)$/, "$1"),
        severity: severity === "error" ? 2 : 1,
      }));
      assert.deepEqual(
        signature(actual, rule),
        signature(expected, rule),
        `${rule} fixture ${index}`,
      );
      assert.equal(signature(expected, rule).length, index === 0 ? 1 : 0, rule);
    }
  }
  const definition = path.join(directory, "ambient.d.ts");
  fs.writeFileSync(definition, "declare namespace Helpers { const n: number; }");
  const [ambientBaseline] = await original.lintFiles([definition]);
  assert.equal(ambientBaseline.errorCount, 0);
  assert.deepEqual(runNative(directory, "--format=json", definition).diagnostics, []);
  const defaults = path.join(directory, "defaults.ts");
  fs.writeFileSync(defaults, "debugger; const unused = 1;");
  assert.deepEqual(runNative(directory, "--format=json", defaults).diagnostics, []);
});

test("residual ESLint keeps unused rules, React scope helpers and multipass fixes", async () => {
  const eslint = new ESLint({ cwd: root, fix: true });
  const source = [
    'import { cn } from "@/shared/lib/utils";',
    'import React, { useMemo } from "react";',
    'import { existsSync } from "node:fs";',
    'export function Probe() { return <div className={cn(String(existsSync(".")))} />; }',
  ].join("\n");
  const [result] = await eslint.lintText(source, {
    filePath: path.join(root, "apps/console/src/features/lint-probe/ui/fix.tsx"),
  });
  assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
  assert.ok(result.output.includes('import React from "react";'), result.output);
  assert.ok(!result.output.includes("useMemo"), result.output);
  assert.ok(result.output.indexOf('from "node:fs"') < result.output.indexOf('from "react"'));
  const [unused] = await eslint.lintText("const _unused = 1; export {};", {
    filePath: path.join(root, "packages/ui/src/unused-probe.ts"),
  });
  assert.ok(
    unused.messages.some(
      ({ ruleId, severity }) => ruleId === "@typescript-eslint/no-unused-vars" && severity === 1,
    ),
  );
  const [merging] = await eslint.lintText("export interface Thing {} export class Thing {}", {
    filePath: path.join(root, "packages/ui/src/merging-probe.ts"),
  });
  assert.equal(
    merging.messages.filter(
      ({ ruleId }) => ruleId === "@typescript-eslint/no-unsafe-declaration-merging",
    ).length,
    2,
  );
  const config = await eslint.calculateConfigForFile(
    path.join(root, "apps/console/src/app/page.tsx"),
  );
  assert.equal(config.rules["react/jsx-uses-react"][0], 2);
  assert.equal(config.rules["react/jsx-uses-vars"][0], 2);
  for (const rule of transferredTypeScriptRules)
    assert.equal(config.rules[`@typescript-eslint/${rule}`][0], 0);
});

test("function length keeps the original threshold and comment/blank-line exceptions", async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "oioi-native-lines-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const config = createOxlintConfig(["**/*.{ts,tsx}"]);
  fs.writeFileSync(path.join(directory, ".oxlintrc.json"), JSON.stringify(config));
  const original = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx}"],
        languageOptions: { parser: tseslint.parser },
        rules: {
          "max-lines-per-function": [
            "warn",
            { max: 250, skipComments: true, skipBlankLines: true },
          ],
        },
      },
    ],
  });
  for (const jsx of [false, true]) {
    for (const count of [250, 251]) {
      const body = jsx
        ? [
            "  return (",
            "    <div>",
            ...Array.from({ length: count - 6 }, (_, index) => `      <span>${index}</span>`),
            "    </div>",
            "  );",
          ]
        : Array.from({ length: count - 2 }, (_, index) => `  const value${index} = ${index};`);
      const source = ["export function probe() {", "  // ignored comment", "", ...body, "}"].join(
        "\n",
      );
      const filename = path.join(directory, `probe-${count}.${jsx ? "tsx" : "ts"}`);
      fs.writeFileSync(filename, source);
      const [baseline] = await original.lintFiles([filename]);
      const actual = runNative(directory, "--format=json", filename).diagnostics;
      assert.equal(actual.length, baseline.messages.length, `function length ${count}, jsx=${jsx}`);
      assert.equal(actual.length, count === 250 ? 0 : 1);
      assert.ok(
        actual.every(
          ({ code, severity }) =>
            code === "eslint(max-lines-per-function)" && severity === "warning",
        ),
      );
    }
  }
});

test("typed lint resolves application/package aliases and preserves the JSX callback exception", (context) => {
  const appRoot = path.join(root, "apps/console");
  const filename = path.join(appRoot, `src/shared/config/native-policy-probe-${process.pid}.tsx`);
  const source = [
    'import { getAdminSongs } from "@/entities/song/api/api";',
    'import { createAdminSongSchema } from "@oioi-bwg/contracts/song";',
    'import type { ReactNode } from "react";',
    "Promise.resolve(1);",
    "getAdminSongs();",
    "createAdminSongSchema.parseAsync({});",
    "[1].forEach(async () => {});",
    "declare const C: (props: { onClick: () => void }) => ReactNode;",
    "export const allowed = <C onClick={async () => {}} />;",
    "void Promise.resolve(1);",
    "Promise.resolve(1).catch(() => {});",
  ].join("\n");
  fs.writeFileSync(filename, source, { flag: "wx" });
  context.after(() => fs.unlinkSync(filename));
  for (const cwd of [root, appRoot]) {
    const { diagnostics } = runNative(
      cwd,
      ...(cwd === root ? [] : ["--config", path.join(root, "oxlint.config.ts")]),
      "--format=json",
      filename,
    );
    const codes = diagnostics.map(({ code }) => code).sort();
    assert.deepEqual(codes, [
      "typescript(no-floating-promises)",
      "typescript(no-floating-promises)",
      "typescript(no-floating-promises)",
      "typescript(no-misused-promises)",
    ]);
    assert.ok(diagnostics.every(({ severity }) => severity === "error"));
  }
});

test("each linter reports unused directives only for the rules it owns", (context) => {
  const filename = path.join(root, `packages/ui/src/native-directive-probe-${process.pid}.ts`);
  context.after(() => fs.unlinkSync(filename));
  for (const [source, unused] of [
    ["// oxlint-disable-next-line typescript/no-explicit-any\nexport type Value = any;", 0],
    ["// oxlint-disable-next-line typescript/no-explicit-any\nexport type Value = string;", 1],
    ["// eslint-disable-next-line react-hooks/set-state-in-effect\nexport const value = 1;", 0],
  ]) {
    fs.writeFileSync(filename, source);
    const { diagnostics } = runNative(root, "--format=json", filename);
    assert.equal(diagnostics.length, unused);
    assert.ok(
      diagnostics.every(
        ({ message, severity }) =>
          message.startsWith("Unused oxlint-disable") && severity === "warning",
      ),
    );
  }
  const files = [
    "apps/web/src/shared/ui/theme-toggle.tsx",
    "apps/web/src/shared/ui/YouTubePlayer.tsx",
    "apps/console/src/shared/ui/YouTubePlayer.tsx",
  ];
  assert.deepEqual(runNative(root, "--format=json", ...files).diagnostics, []);
});
