import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { ESLint } from "eslint";

test("contracts lint rejects platform and implementation dependencies", async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../..");
  const eslint = new ESLint({ cwd: path.join(repositoryRoot, "packages/contracts") });
  for (const source of [
    'export { readFile } from "node:fs";',
    'export { cache } from "react";',
    'export { NextResponse } from "next/server";',
    'export { getDatabase } from "@oioi-bwg/server/db";',
    'export { auth } from "../../../apps/web/src/auth";',
  ]) {
    const [{ messages }] = await eslint.lintText(source, { filePath: "src/boundary-probe.ts" });
    assert.ok(
      messages.some(({ ruleId }) => ruleId === "no-restricted-imports"),
      source,
    );
  }
  const [{ errorCount }] = await eslint.lintText('export { z } from "zod";', {
    filePath: "src/boundary-probe.ts",
  });
  assert.equal(errorCount, 0);
});

test("server database entry rejects client conditions and loads without connecting under server conditions", () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../..");
  const entry = "@oioi-bwg/server/db";
  const code = `import(${JSON.stringify(entry)})`;
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const options = { cwd: repositoryRoot, encoding: "utf8", env };
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

test("server lint rejects app/framework dependencies and reversed persistence boundaries", async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "../..");
  const eslint = new ESLint({ cwd: path.join(repositoryRoot, "packages/server") });
  for (const [filePath, dependency] of [
    ["src/auth/probe.ts", "react"],
    ["src/auth/probe.ts", "next/server"],
    ["src/auth/probe.ts", "@/auth"],
    ["src/auth/probe.ts", "@oioi-bwg/web/src/auth"],
    ["src/auth/probe.ts", "../../../apps/web/src/auth"],
    ["src/services/probe.ts", "drizzle-orm"],
    ["src/services/probe.ts", "../db/postgres-error.js"],
    ["src/repositories/probe.ts", "../services/song-service.js"],
    ["src/repositories/probe.ts", "../errors/app-error.js"],
  ]) {
    const [{ messages }] = await eslint.lintText(`export * from "${dependency}";`, { filePath });
    assert.ok(
      messages.some(({ ruleId }) => ruleId === "no-restricted-imports"),
      dependency,
    );
  }
  const [{ errorCount }] = await eslint.lintText('export { getDatabase } from "../db/index.js";', {
    filePath: "src/services/probe.ts",
  });
  assert.equal(errorCount, 0);
});
