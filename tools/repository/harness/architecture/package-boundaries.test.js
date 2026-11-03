import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../../../..");
const nativeBin = path.join(root, "node_modules/oxlint/bin/oxlint");

// 실제 owner 경로에서 검사해 root와 workspace의 설정 선택을 함께 보호한다.
test("runtime dependency boundaries match in repository and workspace checks", (context) => {
  const cases = [
    ...[
      "@oioi-bwg/config/next",
      "@oioi-bwg/server/db",
      "../../web/src/auth",
      "../../../packages/server/src/db",
      "next/server",
      "node:fs",
    ].map((dependency) => ({ owner: "apps/sentry-slack-relay", folder: "src", dependency })),
    {
      owner: "apps/sentry-slack-relay",
      folder: "src",
      dependency: "@oioi-bwg/config/next",
      dynamic: true,
    },
    {
      owner: "apps/sentry-slack-relay",
      folder: `src/native-boundary-${process.pid}`,
      dependency: "../index.mts",
      allowed: true,
    },
    ...[
      "node:fs",
      "react",
      "next/server",
      "@oioi-bwg/server/db",
      "../../../apps/web/src/auth",
      "@oioi-bwg/config/next",
    ].map((dependency) => ({ owner: "packages/contracts", folder: "src", dependency })),
    { owner: "packages/contracts", folder: "src", dependency: "zod", allowed: true },
    ...[
      "react",
      "@oioi-bwg/config/next",
      "next/server",
      "@/auth",
      "@oioi-bwg/web/src/auth",
      "../../../apps/web/src/auth",
    ].map((dependency) => ({ owner: "packages/server", folder: "src/auth", dependency })),
    ...["drizzle-orm", "../db/postgres-error.js"].map((dependency) => ({
      owner: "packages/server",
      folder: "src/services",
      dependency,
    })),
    ...["../services/song-service.js", "../errors/app-error.js"].map((dependency) => ({
      owner: "packages/server",
      folder: "src/repositories",
      dependency,
    })),
    {
      owner: "packages/server",
      folder: "src/services",
      dependency: "../db/index.js",
      allowed: true,
    },
    ...["next/server", "@oioi-bwg/server/db", "@oioi-bwg/contracts/song"].map((dependency) => ({
      owner: "packages/ui",
      folder: "src",
      dependency,
    })),
  ];
  const created = [];
  const directories = new Set();
  context.after(() => {
    for (const filename of created) fs.unlinkSync(filename);
    for (const directory of directories) {
      try {
        fs.rmdirSync(directory);
      } catch (error) {
        if (error.code !== "ENOTEMPTY") throw error;
      }
    }
  });
  for (const [index, item] of cases.entries()) {
    const directory = path.join(root, item.owner, item.folder);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
      directories.add(directory);
    }
    const extension = item.owner.startsWith("apps/") ? "mts" : "ts";
    item.filename = path.join(directory, `native-boundary-${process.pid}-${index}.${extension}`);
    const source = item.dynamic
      ? `export const load = () => import(${JSON.stringify(item.dependency)});`
      : `export * from ${JSON.stringify(item.dependency)};`;
    fs.writeFileSync(item.filename, source, { flag: "wx" });
    created.push(item.filename);
  }
  for (const cwd of [root, ...new Set(cases.map(({ owner }) => path.join(root, owner)))]) {
    const selected = cases.filter(({ owner }) => cwd === root || cwd === path.join(root, owner));
    const result = spawnSync(
      process.execPath,
      [
        nativeBin,
        "--type-aware",
        "--report-unused-disable-directives-severity",
        "warn",
        "--format=json",
        ...selected.map(({ filename }) => filename),
      ],
      { cwd, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const { diagnostics } = JSON.parse(result.stdout);
    for (const item of selected) {
      const found = diagnostics.filter(
        ({ filename }) => path.resolve(cwd, filename) === item.filename,
      );
      if (item.allowed) assert.deepEqual(found, [], `${cwd}: ${item.dependency}`);
      else
        assert.ok(
          found.some(({ code }) =>
            [
              "core-js(no-restricted-imports)",
              "core-js(no-restricted-syntax)",
              "worker-boundary(local-import)",
            ].includes(code),
          ),
          `${cwd}: ${item.dependency}: ${JSON.stringify(found)}`,
        );
    }
  }
});

test("server database entry rejects client conditions and loads without connecting under server conditions", () => {
  const code = 'import("@oioi-bwg/server/db")';
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const options = { cwd: path.resolve(import.meta.dirname, "../.."), encoding: "utf8", env };
  const client = spawnSync(process.execPath, ["--import", "tsx", "--eval", code], options);
  assert.equal(client.error, undefined);
  assert.notEqual(client.status, 0);
  assert.match(client.stderr, /cannot be imported from a Client Component/);
  const server = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", "--eval", code],
    options,
  );
  assert.equal(server.error, undefined);
  assert.equal(server.status, 0, server.stderr);
});
