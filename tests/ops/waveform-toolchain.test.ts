import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("파형 CLI가 입력 옵션과 URL을 실행 전에 거절한다", () => {
  const result = spawnSync("python3", ["ops/waveform/analyze.py", "https://example.test/audio"], {
    encoding: "utf8",
    timeout: 5_000,
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe("WAVEFORM_ANALYSIS_FAILED\n");
});
