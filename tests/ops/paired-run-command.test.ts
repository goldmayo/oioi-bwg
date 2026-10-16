import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

const roots: string[] = [];
const pair = ["a", "b"].map((value) => `sha256:${value.repeat(64)}`);
const payload = Buffer.from(
  JSON.stringify({
    prNumber: 142,
    sourceSha: "c".repeat(40),
    sourceTree: "d".repeat(40),
    runId: 17,
    runAttempt: 1,
    baseline: null,
    buildConfigHash: "e".repeat(64),
    images: Object.fromEntries(
      ["web", "console"].map((app, i) => [
        app,
        {
          repository: `registry.test/namespace/${app}`,
          digest: pair[i],
          buildSourceSha: "c".repeat(40),
          origin: "built",
        },
      ]),
    ),
  }),
).toString("base64url");
const validArgs = [...pair, payload];
const secret = "fixture-console-private-material";

async function execute(args = validArgs, extra: NodeJS.ProcessEnv = {}) {
  const root = await mkdtemp(join(tmpdir(), "paired-run-command-"));
  roots.push(root);
  await writeFile(
    join(root, "oci"),
    `#!/usr/bin/python3
import json, os, pathlib, sys
args=sys.argv[1:]
root=pathlib.Path(os.environ['MOCK_ROOT'])
with (root/'calls').open('a') as f: f.write(json.dumps(args)+'\\n')
if args[:3]==['instance-agent','command','create']:
    if os.environ.get('MOCK_ERROR')=='create':
        print('${secret}', file=sys.stderr); sys.exit(1)
    print('ocid1.instanceagentcommand.test.fixture')
else:
    if os.environ.get('MOCK_ERROR')=='lookup':
        print('${secret}', file=sys.stderr); sys.exit(1)
    if os.environ.get('MOCK_DELAY') and not (root/'delayed').exists():
        (root/'delayed').touch()
        print('NotAuthorizedOrNotFound ${secret}', file=sys.stderr); sys.exit(1)
    print(json.dumps({'data':{'lifecycle-state':os.environ.get('MOCK_STATE','SUCCEEDED'),
        'content':{'exit-code':json.loads(os.environ.get('MOCK_EXIT','0')),
        'message':'${secret}', 'text':'CONSOLE_MFA_ENCRYPTION_KEY=${secret}'}}}))
`,
  );
  await writeFile(join(root, "sleep"), "#!/bin/sh\nexit 0\n");
  await Promise.all(["oci", "sleep"].map((name) => chmod(join(root, name), 0o700)));
  const result = spawnSync("bash", [resolve("ops/oci/deploy-via-run-command.sh"), ...args], {
    encoding: "utf8",
    timeout: 5_000,
    env: {
      PATH: `${root}:${process.env.PATH}`,
      TMPDIR: root,
      MOCK_ROOT: root,
      OCI_COMPUTE_COMPARTMENT_OCID: "fixture-compartment",
      OCI_COMPUTE_INSTANCE_OCID: "fixture-instance",
      ...extra,
    },
  });
  const calls: string[][] = await readFile(join(root, "calls"), "utf8")
    .then((value) =>
      value
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    )
    .catch(() => []);
  expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
  expect((await readdir(root)).filter((name) => name.startsWith("tmp."))).toEqual([]);
  return { result, calls };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("paired OCI Run Command transport", () => {
  test.each([
    [],
    [pair[0]],
    pair,
    [...pair, "extra"],
    [...validArgs, "extra"],
    ["latest", pair[1], payload],
    [pair[0], `${pair[1]};id`, payload],
    [pair[1], pair[0], payload],
  ])("rejects invalid pair arguments before contacting OCI: %j", async (...args) => {
    const { result, calls } = await execute(args);
    expect(result.status).toBe(2);
    expect(calls).toEqual([]);
  });

  test.each([0, 20, 21])(
    "passes the exact pair and preserves exit %i without remote secrets",
    async (code) => {
      const { result, calls } = await execute(validArgs, {
        MOCK_EXIT: String(code),
        MOCK_STATE: code ? "FAILED" : "SUCCEEDED",
      });
      expect(result.status, result.stderr).toBe(code);
      const create = calls[0];
      const content = JSON.parse(create[create.indexOf("--content") + 1]);
      expect(content.source.text).toBe(
        `sudo /srv/oioibawige/scripts/deploy-release.sh ${validArgs.join(" ")}`,
      );
      expect(JSON.parse(create[create.indexOf("--target") + 1])).toEqual({
        instanceId: "fixture-instance",
      });
      expect(calls[1]).toEqual([
        "instance-agent",
        "command-execution",
        "get",
        "--command-id",
        "ocid1.instanceagentcommand.test.fixture",
        "--instance-id",
        "fixture-instance",
      ]);
    },
  );

  test("waits for delayed execution without creating a second command", async () => {
    const { result, calls } = await execute(validArgs, { MOCK_DELAY: "1" });
    expect(result.status).toBe(0);
    expect(calls.filter((args) => args[1] === "command")).toHaveLength(1);
    expect(calls.filter((args) => args[1] === "command-execution")).toHaveLength(2);
  });

  test.each(["create", "lookup"])("hides OCI %s errors", async (phase) => {
    const { result } = await execute(validArgs, { MOCK_ERROR: phase });
    expect(result.status).toBe(1);
  });

  test.each(["null", '"20"', "-1", "256", "1.5"])(
    "rejects invalid host exit code %s",
    async (code) => {
      const { result } = await execute(validArgs, { MOCK_EXIT: code });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Invalid Run Command exit code");
    },
  );

  test.each(["TIMED_OUT", "CANCELED"])("does not report rollback after %s", async (state) => {
    const { result } = await execute(validArgs, { MOCK_STATE: state, MOCK_EXIT: "20" });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("rollback succeeded");
  });

  test.each(["FAILED", "TIMED_OUT", "CANCELED"])(
    "rejects %s with a zero exit code",
    async (state) => {
      const { result } = await execute(validArgs, { MOCK_STATE: state });
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain("deployment succeeded");
    },
  );
});
