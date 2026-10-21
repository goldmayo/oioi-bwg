import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "vitest";

test.each([false, true])(
  "retirement verifier checks only restored standalone artifacts (retired action: %s)",
  (retired) => {
    const directory = mkdtempSync(path.join(tmpdir(), "p06-restored-artifact-"));
    try {
      const server = path.join(directory, "apps/web/.next/standalone/apps/web/.next/server");
      mkdirSync(server, { recursive: true });
      writeFileSync(
        path.join(server, "server-reference-manifest.json"),
        JSON.stringify({
          node: retired ? { captured: { exportedName: "uploadAlbumImageAction" } } : {},
        }),
      );
      const verifier = pathToFileURL(path.resolve("tests/ops/web-admin-retired-smoke.mjs")).href;
      const source = `const { assertWebAdminRetired } = await import(${JSON.stringify(verifier)});
      try {
        await assertWebAdminRetired(null, "http://fixture.invalid", () => { throw Error("DB_BOUNDARY_REACHED"); }, ".");
        process.exitCode = 1;
      } catch (error) {
        console.log(error.code === "ERR_ASSERTION" ? "RETIRED_ACTION_REJECTED" : error.message);
      }`;
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
        cwd: directory,
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe(
        retired ? "RETIRED_ACTION_REJECTED" : "DB_BOUNDARY_REACHED",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
