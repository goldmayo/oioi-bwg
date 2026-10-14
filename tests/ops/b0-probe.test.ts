import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test } from "vitest";

test.each([
  ["python3", ["-B", "-I", resolve("tests/ops/b0-probe-fixture.py")]],
  ["node", [resolve("tests/ops/b0-command-fixture.mjs")]],
])("B0 privilege boundary and output protection: %s", (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 10_000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
