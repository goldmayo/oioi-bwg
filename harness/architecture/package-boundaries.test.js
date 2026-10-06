import assert from "node:assert/strict";
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
