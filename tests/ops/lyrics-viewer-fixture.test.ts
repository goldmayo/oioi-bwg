import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

test.each([
  "postgresql://fixture@production.invalid/image_smoke",
  "postgresql://fixture@127.0.0.1/oioibawige",
  "postgresql://fixture@127.0.0.1/oioi_m7_test_other",
  "postgresql://fixture@127.0.0.1/image_smoke?host=production.invalid",
  "https://127.0.0.1/image_smoke",
])("응원법 브라우저 fixture는 허용하지 않은 DB %s에 연결하지 않는다", (url) => {
  const result = spawnSync(process.execPath, ["tests/ops/lyrics-viewer-fixture.mjs"], {
    env: { ...process.env, LYRICS_SMOKE_DATABASE_URL: url },
    encoding: "utf8",
    timeout: 5_000,
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("AssertionError");
  expect(result.stderr).not.toMatch(/ECONNREFUSED|ENOTFOUND|password authentication failed/);
});
