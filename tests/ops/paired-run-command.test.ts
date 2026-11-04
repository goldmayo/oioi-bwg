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
    states=json.loads(os.environ.get('MOCK_STATES','null'))
    index=int((root/'poll-index').read_text()) if (root/'poll-index').exists() else 0
    (root/'poll-index').write_text(str(index+1))
    state=states[min(index,len(states)-1)] if states else os.environ.get('MOCK_STATE','SUCCEEDED')
    print(json.dumps({'data':{'lifecycle-state':state,
        'time-created':os.environ.get('MOCK_CREATED_AT'), 'time-updated':os.environ.get('MOCK_UPDATED_AT'),
        'content':{'exit-code':json.loads(os.environ.get('MOCK_EXIT','0')),
        'message':'${secret}', 'text':os.environ.get('MOCK_TEXT','CONSOLE_MFA_ENCRYPTION_KEY=${secret}')}}}))
`,
  );
  await writeFile(join(root, "sleep"), "#!/bin/sh\nexit 0\n");
  await Promise.all(["oci", "sleep"].map((name) => chmod(join(root, name), 0o700)));
  if (extra.MOCK_WALL_ROLLBACK) {
    await writeFile(
      join(root, "date"),
      `#!/usr/bin/python3
import pathlib,os
p=pathlib.Path(os.environ['MOCK_ROOT'])/'wall-clock-calls'
n=int(p.read_text()) if p.exists() else 0
p.write_text(str(n+1));print(10000 if n==0 else 9000)
`,
      { mode: 0o700 },
    );
  }
  if (extra.MOCK_CLOCK_EXPIRE) {
    await writeFile(
      join(root, "python3"),
      `#!/usr/bin/python3
import pathlib,os,sys
if '-c' in sys.argv and 'monotonic_ns' in sys.argv[-1]:
    p=pathlib.Path(os.environ['MOCK_ROOT'])/'clock-calls'
    n=int(p.read_text()) if p.exists() else 0
    p.write_text(str(n+1));print([0,100,200,901000,901100][min(n,4)])
else:os.execv('/usr/bin/python3',['python3',*sys.argv[1:]])
`,
      { mode: 0o700 },
    );
  }
  const result = spawnSync("bash", [resolve("ops/oci/deploy-via-run-command.sh"), ...args], {
    encoding: "utf8",
    timeout: 5_000,
    env: {
      PATH: `${root}:${process.env.PATH}`,
      TMPDIR: root,
      MOCK_ROOT: root,
      GITHUB_STEP_SUMMARY: join(root, "summary"),
      GITHUB_OUTPUT: join(root, "output"),
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
  const report = await readFile(join(root, "deployment-timing.json"), "utf8")
    .then(JSON.parse)
    .catch(() => null);
  const summary = await readFile(join(root, "summary"), "utf8").catch(() => "");
  expect(JSON.stringify(report) + summary).not.toContain(secret);
  const wallClockCalls = await readFile(join(root, "wall-clock-calls"), "utf8").catch(() => "0");
  return { result, calls, report, summary, wallClockCalls };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("paired OCI Run Command transport", () => {
  test("벽시계 역행과 무관하게 단조 시계로 시간을 측정한다", async () => {
    const { result, report, wallClockCalls } = await execute(validArgs, {
      MOCK_WALL_ROLLBACK: "1",
    });
    expect(result.status).toBe(0);
    expect(wallClockCalls).toBe("0");
    expect(report.commandCreateMs).toBeGreaterThanOrEqual(0);
    expect(report.waitAndExecutionMs).toBeGreaterThanOrEqual(0);
  });
  test("단조 시계의 전체 제한이 지나면 두 번째 명령 없이 중단한다", async () => {
    const { result, calls } = await execute(validArgs, { MOCK_CLOCK_EXPIRE: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("did not reach a terminal state");
    expect(calls).toHaveLength(1);
  });
  test("첫 실행 관측·진행 상태·서비스 구간을 고정 숫자로만 기록한다", async () => {
    const { result, report, summary } = await execute(validArgs, {
      MOCK_STATES: '["ACCEPTED","IN_PROGRESS","SUCCEEDED"]',
      MOCK_CREATED_AT: "2026-11-03T10:22:15.948Z",
      MOCK_UPDATED_AT: "2026-11-03T10:26:13.124Z",
    });
    expect(result.status).toBe(0);
    expect(report.poll).toMatchObject({ attempts: 3, notFound: 0, serviceElapsedMs: 237176 });
    expect(report.poll.requestMs).toBeGreaterThanOrEqual(0);
    expect(report.poll.firstInProgressObservedMs).toBeGreaterThanOrEqual(
      report.poll.firstExecutionObservedMs,
    );
    expect(summary).toContain("| poll.serviceElapsedMs | 237176 |");
  });
  test.each([
    [secret, "2026-11-03T10:26:13Z"],
    ["2026-11-03T10:26:13Z", "2026-11-03T10:22:15Z"],
    ["2026-11-03T10:00:00", "2026-11-03T10:01:00"],
  ])("잘못된 서비스 시간은 배포 결과에 영향 없이 생략한다", async (created, updated) => {
    const { result, report } = await execute(validArgs, {
      MOCK_CREATED_AT: created,
      MOCK_UPDATED_AT: updated,
    });
    expect(result.status).toBe(0);
    expect(report.poll.serviceElapsedMs).toBeUndefined();
  });
  test("exports only allowlisted stage numbers while legacy output remains optional", async () => {
    const { result, report, summary } = await execute(validArgs, {
      MOCK_TEXT: `${secret}\nOIOI_DEPLOY_TIMING materialize_web 125\nOIOI_DEPLOY_TIMING total 250\n`,
    });
    expect(result.status).toBe(0);
    expect(report.host).toEqual({ materialize_web: 125, total: 250 });
    expect(report.commandCreateMs).toBeGreaterThanOrEqual(0);
    expect(report.waitAndExecutionMs).toBeGreaterThanOrEqual(0);
    expect(summary).toContain("| materialize_web | 125 |");
    const legacy = await execute();
    expect(legacy.result.status).toBe(0);
    expect(legacy.report.host).toEqual({});
  });
  test("invalid timing never changes the deployment result or leaks raw output", async () => {
    const { result, report } = await execute(validArgs, {
      MOCK_EXIT: "20",
      MOCK_STATE: "FAILED",
      MOCK_TEXT: `OIOI_DEPLOY_TIMING total 10\nOIOI_DEPLOY_TIMING total ${secret}`,
    });
    expect(result.status).toBe(20);
    expect(report.host).toEqual({});
  });
  test.each([0, 20, 21])(
    "preserves exit %i when the timing report cannot be written",
    async (code) => {
      const { result, report } = await execute(validArgs, {
        MOCK_EXIT: String(code),
        MOCK_STATE: code ? "FAILED" : "SUCCEEDED",
        RUNNER_TEMP: "/dev/null",
      });
      expect(result.status).toBe(code);
      expect(result.stdout).toContain("Deployment timing unavailable");
      expect(report).toBeNull();
    },
  );
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
    const { result, calls, report } = await execute(validArgs, { MOCK_DELAY: "1" });
    expect(result.status).toBe(0);
    expect(calls.filter((args) => args[1] === "command")).toHaveLength(1);
    expect(calls.filter((args) => args[1] === "command-execution")).toHaveLength(2);
    expect(report.poll).toMatchObject({ attempts: 2, notFound: 1 });
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
