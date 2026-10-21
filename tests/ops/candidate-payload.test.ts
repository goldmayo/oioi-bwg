import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, describe, expect, test } from "vitest";

const emptyConfig = mkdtempSync(join(tmpdir(), "candidate-boundary-"));
const digests = ["a", "b"].map((value) => `sha256:${value.repeat(64)}`);
afterAll(() => rmSync(emptyConfig, { recursive: true, force: true }));

// Stop at the next guard: these tests must never contact OCI or a real host.
describe.each([
  ["deploy-release.sh", "invalid_candidate_payload", "required_protected_file_missing", 1],
  [
    "deploy-via-run-command.sh",
    "bounded candidate payload are required",
    "OCI_COMPUTE_COMPARTMENT_OCID is required",
    2,
  ],
] as const)("%s candidate text boundary", (script, rejected, accepted, rejectionCode) => {
  test.each([
    ["empty", "", false],
    ["one character", "a", true],
    ["base64url alphabet", "AZaz09_-", true],
    ["maximum length", "a".repeat(16000), true],
    ["over maximum", "a".repeat(16001), false],
    ["padding", "abc=", false],
    ["space", "abc def", false],
    ["newline", "abc\n", false],
    ["shell punctuation", "abc;id", false],
    ["non-ASCII", "코드", false],
  ] as const)("%s", (_label, payload, allowed) => {
    const result = spawnSync("bash", [resolve("ops/oci", script), ...digests, payload], {
      encoding: "utf8",
      timeout: 5000,
      env: {
        PATH: process.env.PATH,
        M9_DEPLOY_TEST_MODE: "1",
        OIOI_CONFIG_ROOT: emptyConfig,
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(allowed ? 1 : rejectionCode);
    expect(result.stderr).toContain(allowed ? accepted : rejected);
  });
});
