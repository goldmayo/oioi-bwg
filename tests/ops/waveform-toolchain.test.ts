import { expect, it } from "vitest";
import { verificationJobs, verificationPassed } from "../../scripts/verification-scope.mjs";

it("Rust ARM64 검증 증거가 없으면 최종 verify를 통과시키지 않는다", () => {
  const needs: Record<string, { result: string; outputs?: { docs_only: string } }> =
    Object.fromEntries(verificationJobs.map((name) => [name, { result: "success" }]));
  needs.changes = { result: "success", outputs: { docs_only: "false" } };
  expect(verificationPassed(needs)).toBe(true);
  delete needs.waveform;
  expect(verificationPassed(needs)).toBe(false);
  needs.waveform = { result: "failure" };
  expect(verificationPassed(needs)).toBe(false);
});
