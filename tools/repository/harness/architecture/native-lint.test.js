import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createAppConfig } from "@oioi-bwg/config/oxlint/app";
import { contractsConfig } from "@oioi-bwg/config/oxlint/contracts";
import { nodeConfig } from "@oioi-bwg/config/oxlint/node";
import { serverConfig } from "@oioi-bwg/config/oxlint/server";
import { uiConfig } from "@oioi-bwg/config/oxlint/ui";
import { workerConfig } from "@oioi-bwg/config/oxlint/worker";

const root = path.resolve(import.meta.dirname, "../../../..");
const nativeBin = path.join(root, "node_modules/oxlint/bin/oxlint");
let fixtureId = 0;

function fixture(context, directory, source, extension = "ts") {
  const filename = path.join(
    root,
    directory,
    `native-policy-probe-${process.pid}-${fixtureId++}.${extension}`,
  );
  fs.writeFileSync(filename, source, { flag: "wx" });
  context.after(() => fs.unlinkSync(filename));
  return filename;
}

function runNative(cwd, ...args) {
  const result = spawnSync(
    process.execPath,
    [nativeBin, "--type-aware", "--report-unused-disable-directives-severity", "warn", ...args],
    {
      cwd,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert.equal(result.error, undefined);
  assert.ok([0, 1].includes(result.status), result.stderr || result.stdout);
  return { ...JSON.parse(result.stdout), status: result.status };
}

function reports(diagnostics, canonicalId) {
  const name = canonicalId.split("/").at(-1);
  return diagnostics.filter(({ code }) => code?.endsWith(`(${name})`));
}

test("standard nearest-workspace configurations retain the 98 configured checks", () => {
  const configs = [
    nodeConfig,
    createAppConfig(path.join(root, "apps/console"), "19.2.4"),
    serverConfig,
    contractsConfig,
    uiConfig,
    workerConfig,
  ];
  const activeRules = new Set();
  for (const config of configs) {
    assert.deepEqual(config.categories, { correctness: "off" });
    assert.ok(config.ignorePatterns.includes("**/*.jsx"));
    assert.equal(config.options, undefined);
    for (const plugin of config.jsPlugins ?? []) {
      assert.ok(path.isAbsolute(plugin.specifier));
      assert.ok(plugin.name);
    }
    for (const rules of [config.rules, ...(config.overrides ?? []).map(({ rules }) => rules)])
      for (const [rule, value] of Object.entries(rules ?? {}))
        if (![0, "off"].includes(Array.isArray(value) ? value[0] : value)) activeRules.add(rule);
  }
  assert.equal(activeRules.size, 98);
});

test("the single engine retains scope, severity and the former parser exceptions", (context) => {
  const examples = [
    ["packages/contracts/src", "export * from 'react';", "no-restricted-imports", 2, 1],
    ["packages/contracts/src", "export * from 'zod/v4';", "no-restricted-imports", 2, 1],
    ["packages/contracts/src", "export * from 'zod';", "no-restricted-imports", 2, 0],
    ["packages/ui/src", "export * from 'next';", "no-restricted-imports", 2, 1],
    ["packages/server/src/services", "export * from 'drizzle-orm';", "no-restricted-imports", 2, 1],
    [
      "packages/server/src/repositories",
      "export * from '../services/song-service';",
      "no-restricted-imports",
      2,
      1,
    ],
    ["apps/sentry-slack-relay/src", "export * from 'node:fs';", "no-restricted-imports", 2, 1],
    ["packages/ui/src", "const _unused = 1; export {};", "@typescript-eslint/no-unused-vars", 1, 1],
    [
      "packages/ui/src",
      "const value = 1; export type Value = typeof value;",
      "@typescript-eslint/no-unused-vars",
      1,
      1,
    ],
    [
      "packages/ui/src",
      "const unused = 1; export {};",
      "@typescript-eslint/no-unused-vars",
      1,
      1,
      "d.ts",
    ],
    [
      "packages/ui/src",
      "export interface Thing {} export class Thing {}",
      "@typescript-eslint/no-unsafe-declaration-merging",
      2,
      2,
    ],
    ["packages/ui/src", "value as number;", "@typescript-eslint/no-unused-expressions", 1, 1],
  ];
  const expected = examples.map(([directory, source, rule, severity, count, extension]) => ({
    filename: fixture(context, directory, source, extension),
    rule,
    severity,
    count,
  }));
  const { diagnostics } = runNative(
    root,
    "--format=json",
    ...expected.map(({ filename }) => filename),
  );
  for (const { filename, rule, severity, count } of expected) {
    const messages = reports(
      diagnostics.filter((entry) => path.resolve(root, entry.filename) === filename),
      rule,
    );
    assert.equal(messages.length, count, `${rule}: ${filename}`);
    assert.ok(
      messages.every((message) => message.severity === (severity === 2 ? "error" : "warning")),
    );
    if (rule === "no-restricted-imports" && filename.includes("/packages/contracts/"))
      assert.ok(
        messages.every(({ message }) =>
          message.includes("공통 계약은 Zod와 내부 계약만 참조합니다."),
        ),
      );
  }
});

test("native defaults add no checks outside the original rules", (context) => {
  const filename = fixture(context, "packages/ui/src", "debugger; export {};\n");
  assert.deepEqual(runNative(root, "--format=json", filename).diagnostics, []);
});

test("function length keeps the 250-line threshold for TS, JSX, comments and blanks", (context) => {
  const expected = [];
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
        : Array.from({ length: count - 2 }, (_, index) => `  console.log(${index});`);
      const source = ["export function probe() {", "  // ignored comment", "", ...body, "}"].join(
        "\n",
      );
      const filename = fixture(
        context,
        "apps/console/src/shared/config",
        source,
        jsx ? "tsx" : "ts",
      );
      expected.push({ filename, count });
    }
  }
  const { diagnostics } = runNative(
    root,
    "--format=json",
    ...expected.map(({ filename }) => filename),
  );
  for (const { filename, count } of expected) {
    const messages = reports(
      diagnostics.filter((entry) => path.resolve(root, entry.filename) === filename),
      "max-lines-per-function",
    );
    assert.equal(messages.length, count === 250 ? 0 : 1);
    assert.ok(messages.every(({ severity }) => severity === "warning"));
  }
});

test("root and app invocation share typed aliases and the JSX callback exception", (context) => {
  const filename = fixture(
    context,
    "apps/console/src/shared/config",
    [
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
    ].join("\n"),
    "tsx",
  );
  for (const cwd of [root, path.join(root, "apps/console")]) {
    const { diagnostics } = runNative(cwd, "--format=json", filename);
    assert.equal(reports(diagnostics, "@typescript-eslint/no-floating-promises").length, 3);
    assert.equal(reports(diagnostics, "@typescript-eslint/no-misused-promises").length, 1);
  }
});

test("native directive ownership retains stale suppression warnings", (context) => {
  const expected = [
    ["// oxlint-disable-next-line typescript/no-explicit-any\nexport type Value = any;", 0],
    ["// oxlint-disable-next-line typescript/no-explicit-any\nexport type Value = string;", 1],
  ].map(([source, unused]) => ({ filename: fixture(context, "packages/ui/src", source), unused }));
  const actualFiles = [
    "apps/web/src/shared/ui/theme-toggle.tsx",
    "apps/web/src/shared/ui/YouTubePlayer.tsx",
    "apps/console/src/shared/ui/YouTubePlayer.tsx",
  ];
  const { diagnostics } = runNative(
    root,
    "--format=json",
    ...expected.map(({ filename }) => filename),
    ...actualFiles,
  );
  for (const { filename, unused } of expected) {
    const messages = diagnostics.filter((entry) => path.resolve(root, entry.filename) === filename);
    assert.equal(messages.length, unused);
    assert.ok(
      messages.every(
        ({ message, severity }) =>
          message.startsWith("Unused oxlint-disable") && severity === "warning",
      ),
    );
  }
  for (const filename of actualFiles)
    assert.ok(
      !diagnostics.some(
        (entry) => path.resolve(root, entry.filename) === path.resolve(root, filename),
      ),
    );
});

test("original React and Next rules retain their wrapper and application-root behavior", (context) => {
  const anonymous = fixture(
    context,
    "apps/console/src/shared/config",
    'import React from "react"; export default React.memo(() => <div />);',
    "tsx",
  );
  const functionDocument = fixture(
    context,
    "apps/console/src/shared/config",
    'import {Head} from "next/document"; export default function Document() { return <><Head /><Head /></>; }',
    "tsx",
  );
  const classDocument = fixture(
    context,
    "apps/console/src/shared/config",
    'import Document, {Html, Head} from "next/document"; export default class MyDocument extends Document { render() { return <Html><Head /><Head /><body /></Html>; } }',
    "tsx",
  );
  const crossApp = fixture(
    context,
    "apps/web/src/shared/config",
    'export const view = <a href="/admin">Console</a>;',
    "tsx",
  );
  const { diagnostics } = runNative(
    root,
    "--format=json",
    anonymous,
    functionDocument,
    classDocument,
    crossApp,
  );
  const forFile = (filename) =>
    diagnostics.filter((entry) => path.resolve(root, entry.filename) === filename);
  assert.equal(reports(forFile(anonymous), "react/display-name").length, 1);
  assert.equal(reports(forFile(functionDocument), "@next/next/no-duplicate-head").length, 0);
  assert.equal(reports(forFile(classDocument), "@next/next/no-duplicate-head").length, 1);
  assert.equal(reports(forFile(crossApp), "@next/next/no-html-link-for-pages").length, 0);
});
