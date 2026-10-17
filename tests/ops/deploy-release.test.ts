import { spawnSync } from "node:child_process";

import { expect, test } from "vitest";

test("paired host preflight, independent reconciliation, joint rollback and legacy transition (fake Docker/OCI)", () => {
  const result = spawnSync("python3", ["-I", "tests/ops/paired-deploy-fixture.py"], {
    encoding: "utf8",
    timeout: 180_000,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stderr).toContain("OK");
}, 185_000);
