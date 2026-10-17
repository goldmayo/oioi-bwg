import { spawnSync } from "node:child_process";

import { expect, test } from "vitest";

test("app runtime env CLI preserves values, isolates keys and rejects partial output", () => {
  const result = spawnSync("python3", ["tests/ops/runtime-env-fixture.py"], {
    encoding: "utf8",
    timeout: 12_000,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
