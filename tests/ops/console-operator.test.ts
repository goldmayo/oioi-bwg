import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

test("host operator guards reject unsafe requests without contacting a VM", () => {
  const result = spawnSync("python3", ["-I", "-B", "tests/ops/console-operator-fixture.py"], {
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
});

test("standalone worker loads through the host protocol and rejects untrusted targets", () => {
  const build = spawnSync(process.execPath, ["scripts/build-console-operator.mjs"], {
    encoding: "utf8",
  });
  expect(build.status, build.stderr).toBe(0);
  const loader = spawnSync(
    "python3",
    [
      "-I",
      "-B",
      "-c",
      "import runpy; print(runpy.run_path('ops/oci/console-operator.py')['LOADER'])",
    ],
    { encoding: "utf8" },
  );
  expect(loader.status, loader.stderr).toBe(0);
  const code = readFileSync(".local/console-operator/console-operator.cjs");
  const request = {
    scope: "oci-console",
    serverStartedAt: "1234567890.000000",
    args: [
      "mfa-reset",
      "--account-id",
      "019a0170-0000-7000-8000-000000000001",
      "--expected-version",
      "3",
      "--apply",
    ],
  };
  for (const [input, url, expected] of [
    [{ ...request, scope: "local-compose" }, "", "INVALID_REQUEST"],
    [
      request,
      "postgresql://oioi_app:never-output@remote.example/oioibawige",
      "DATABASE_TARGET_REJECTED",
    ],
    [request, "postgresql://postgres:never-output@postgres/oioibawige", "DATABASE_TARGET_REJECTED"],
    [{ ...request, args: request.args.slice(0, -1) }, "", "INVALID_REQUEST"],
  ] as const) {
    const result = spawnSync(process.execPath, ["--input-type=commonjs", "-e", loader.stdout], {
      input: Buffer.concat([
        Buffer.from(code.length.toString(16).padStart(8, "0")),
        code,
        Buffer.from(JSON.stringify(input)),
      ]),
      env: { PATH: process.env.PATH, DATABASE_URL: url },
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({ success: false, code: expected });
    expect(result.stdout + result.stderr).not.toContain("never-output");
  }
});
