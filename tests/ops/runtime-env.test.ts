import { spawnSync } from "node:child_process";

import { expect, test } from "vitest";

test("app runtime env CLI isolates keys and rejects incomplete Console GA4 settings", () => {
  const result = spawnSync("python3", ["-I", "tests/ops/runtime-env-fixture.py"], {
    encoding: "utf8",
    timeout: 12_000,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
