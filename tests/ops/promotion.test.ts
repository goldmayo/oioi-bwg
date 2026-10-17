import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { describe, expect, test, vi } from "vitest";

import {
  assertCandidate,
  assertPromotion,
  assertSameTree,
  buildConfigHash,
  prepare,
  record,
  recordDeployment,
  resolve as resolvePromotion,
  selectCandidateRun,
} from "../../ops/oci/promotion.mjs";

vi.mock("node:fs/promises", async (original) => ({
  ...(await original<typeof import("node:fs/promises")>()),
  writeFile: vi.fn(),
  readFile: vi.fn((await original<typeof import("node:fs/promises")>()).readFile),
}));

const sourceSha = "a".repeat(40);
const sourceTree = "b".repeat(40);
const mergedSha = "c".repeat(40);
const imageDigest = `sha256:${"d".repeat(64)}`;
const repository = "goldmayo/oioi-bwg";
const pr = {
  number: 123,
  state: "closed",
  merged: true,
  merged_at: "2026-10-05T10:10:00Z",
  merge_commit_sha: mergedSha,
  base: { ref: "migration_develop" },
  head: { ref: "migration_main", sha: sourceSha, repo: { full_name: repository } },
};
const candidate = {
  prNumber: pr.number,
  sourceSha,
  sourceTree,
  baseline: null,
  buildConfigHash: buildConfigHash(),
  images: {
    web: {
      buildSourceSha: sourceSha,
      origin: "built",
      repository: "registry.example/namespace/web",
      digest: imageDigest,
    },
    console: {
      buildSourceSha: sourceSha,
      origin: "built",
      repository: "registry.example/namespace/console",
      digest: `sha256:${"e".repeat(64)}`,
    },
  },
  runId: 17,
  runAttempt: 1,
};
const run = {
  id: 17,
  run_attempt: 1,
  event: "pull_request",
  head_sha: sourceSha,
  head_branch: "migration_main",
  head_repository: { full_name: repository },
  pull_requests: [{ number: pr.number }],
  created_at: "2026-10-05T10:00:00Z",
  status: "completed",
  conclusion: "success",
};

function fixture() {
  const jobs = ["verify", "promotion", "promotion candidate"].map((name) => ({
    name,
    conclusion: "success",
    completed_at: "2026-10-05T10:05:00Z",
  }));
  const artifacts = [
    {
      id: 99,
      name: `promotion-${sourceSha}-1`,
      expired: false,
      created_at: "2026-10-05T10:04:00Z",
    },
  ];
  const livePr = structuredClone(pr);
  const github = {
    rest: {
      pulls: { get: vi.fn(async () => ({ data: livePr })) },
      repos: { getBranch: vi.fn(async () => ({ data: { commit: { sha: mergedSha } } })) },
      git: {
        getCommit: vi.fn(async () => ({ data: { tree: { sha: sourceTree }, parents: [{}] } })),
      },
      actions: {
        listWorkflowRuns: vi.fn(async () => ({ data: { workflow_runs: [run] } })),
        listJobsForWorkflowRunAttempt: vi.fn(),
        listWorkflowRunArtifacts: vi.fn(),
      },
    },
    paginate: vi.fn(async (method: unknown) =>
      method === github.rest.actions.listJobsForWorkflowRunAttempt ? jobs : artifacts,
    ),
  };
  const core = {
    setOutput: vi.fn(),
    summary: {
      addHeading: vi.fn().mockReturnThis(),
      addTable: vi.fn().mockReturnThis(),
      write: vi.fn(),
    },
  };
  const context = {
    repo: { owner: "goldmayo", repo: "oioi-bwg" },
    sha: mergedSha,
    payload: { pull_request: pr },
  };
  return { github, core, context, livePr, jobs, artifacts };
}

describe("migration promotion identity", () => {
  test.each([
    { ...pr, base: { ref: "migration_main" } },
    { ...pr, head: { ...pr.head, ref: "feature/P01" } },
    { ...pr, head: { ...pr.head, repo: { full_name: "fork/oioi-bwg" } } },
  ])("rejects ordinary feature or fork promotions", (value) => {
    expect(() => assertPromotion(value, repository)).toThrow();
  });

  test.each(["sourceSha", "sourceTree", "prNumber", "runId", "runAttempt"])(
    "rejects a mismatched %s",
    (key) => {
      const value =
        typeof candidate[key as keyof typeof candidate] === "number" ? 999 : "e".repeat(40);
      expect(() => assertCandidate({ ...candidate, [key]: value }, candidate)).toThrow();
    },
  );

  test("requires immutable digest and exact source/merge tree", () => {
    expect(() => assertSameTree(sourceTree, "f".repeat(40))).toThrow();
    expect(() => assertCandidate(candidate, candidate)).not.toThrow();
  });

  test.each(["web", "console"] as const)("rejects missing, mutable or foreign %s images", (app) => {
    for (const image of [
      undefined,
      { ...candidate.images[app], digest: "latest" },
      { ...candidate.images[app], repository: "other.invalid/foreign/app" },
      { ...candidate.images[app], runId: 999 },
      candidate.images[app === "web" ? "console" : "web"],
    ]) {
      expect(() =>
        assertCandidate({ ...candidate, images: { ...candidate.images, [app]: image } }, candidate),
      ).toThrow();
    }
  });

  test("rejects legacy, duplicate or extra app candidates", () => {
    expect(() =>
      assertCandidate({ ...candidate, images: undefined, imageDigest }, candidate),
    ).toThrow();
    expect(() =>
      assertCandidate(
        { ...candidate, images: { ...candidate.images, worker: candidate.images.web } },
        candidate,
      ),
    ).toThrow();
    const duplicate = {
      ...candidate,
      images: { web: candidate.images.web, console: candidate.images.web },
    };
    expect(() => assertCandidate(duplicate, duplicate)).toThrow("distinct");
  });

  test("records and reports both digests under the checked source/run/attempt", async () => {
    const f = fixture();
    f.livePr.state = "open";
    f.github.rest.repos.getBranch.mockResolvedValue({ data: { commit: { sha: sourceSha } } });
    for (const [key, value] of Object.entries({
      GITHUB_RUN_ID: "17",
      GITHUB_RUN_ATTEMPT: "1",
      IMAGE_REPOSITORY: candidate.images.web.repository,
      IMAGE_DIGEST: imageDigest,
      CONSOLE_IMAGE_REPOSITORY: candidate.images.console.repository,
      CONSOLE_IMAGE_DIGEST: candidate.images.console.digest,
      PAIR_SMOKE_FILE: "/fixture/smoke.json",
    }))
      vi.stubEnv(key, value);
    vi.mocked(writeFile).mockClear();
    vi.mocked(readFile).mockResolvedValueOnce(
      JSON.stringify({
        runId: 17,
        runAttempt: 1,
        images: Object.fromEntries(
          Object.entries(candidate.images).map(([app, image]) => [
            app,
            { digest: image.digest, buildSourceSha: image.buildSourceSha },
          ]),
        ),
      }),
    );
    try {
      await record(f);
      const [file, contents] = vi.mocked(writeFile).mock.calls[0];
      expect(file).toBe("candidate.json");
      expect(JSON.parse(String(contents))).toEqual(candidate);
      expect(f.core.summary.addTable).toHaveBeenCalledWith(
        expect.arrayContaining([
          ["web", `${candidate.images.web.repository}@${imageDigest}`],
          ["console", `${candidate.images.console.repository}@${candidate.images.console.digest}`],
        ]),
      );
      const oldBuild = "f".repeat(40);
      const selected = {
        sourceSha,
        buildConfigHash: candidate.buildConfigHash,
        baseline: { releaseId: "0".repeat(64), runId: 31, runAttempt: 1, artifactId: 99 },
        build: { web: true, console: false },
        images: {
          ...candidate.images,
          console: { ...candidate.images.console, origin: "reused", buildSourceSha: oldBuild },
        },
      };
      vi.stubEnv("IMAGE_PLAN_FILE", "/fixture/plan.json");
      vi.mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(selected))
        .mockResolvedValueOnce(
          JSON.stringify({ runId: 17, runAttempt: 1, images: selected.images }),
        );
      vi.mocked(writeFile).mockClear();
      await record(f);
      const reused = JSON.parse(String(vi.mocked(writeFile).mock.calls[0][1]));
      expect(reused.sourceSha).toBe(sourceSha);
      expect(reused.images.console).toMatchObject({ origin: "reused", buildSourceSha: oldBuild });
      expect(reused.baseline).toEqual(selected.baseline);
      vi.stubEnv("IMAGE_PLAN_FILE", "");
      vi.mocked(writeFile).mockClear();
      vi.stubEnv("CONSOLE_IMAGE_DIGEST", "");
      await expect(record(f)).rejects.toThrow("immutable digest");
      expect(writeFile).not.toHaveBeenCalled();
      vi.stubEnv("CONSOLE_IMAGE_DIGEST", candidate.images.console.digest);
      for (const invalid of [
        undefined,
        { runId: 17, runAttempt: 2, images: candidate.images },
        {
          runId: 17,
          runAttempt: 1,
          images: {
            ...candidate.images,
            console: { ...candidate.images.console, digest: imageDigest },
          },
        },
      ]) {
        if (invalid) vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(invalid));
        else vi.mocked(readFile).mockRejectedValueOnce(new Error("missing smoke proof"));
        vi.mocked(writeFile).mockClear();
        await expect(record(f)).rejects.toThrow();
        expect(writeFile).not.toHaveBeenCalled();
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("does not reuse another head or PR even when its tree could be identical", () => {
    expect(() => selectCandidateRun([{ ...run, head_sha: "e".repeat(40) }], pr)).toThrow();
    expect(() => selectCandidateRun([{ ...run, pull_requests: [{ number: 999 }] }], pr)).toThrow();
  });

  test("blocks latest incomplete/failed rerun and excludes post-merge rebuilds", () => {
    expect(() =>
      selectCandidateRun([run, { ...run, id: 18, status: "in_progress" }], pr),
    ).toThrow();
    expect(() =>
      selectCandidateRun([run, { ...run, id: 18, conclusion: "failure" }], pr),
    ).toThrow();
    expect(
      selectCandidateRun([run, { ...run, id: 18, created_at: "2026-10-05T10:11:00Z" }], pr).id,
    ).toBe(17);
  });

  test("prevents publish when the PR or integration head changed", async () => {
    const f = fixture();
    f.livePr.state = "open";
    await expect(prepare(f)).rejects.toThrow("head changed");
    f.github.rest.repos.getBranch.mockResolvedValue({ data: { commit: { sha: sourceSha } } });
    f.livePr.head.sha = "e".repeat(40);
    await expect(prepare(f)).rejects.toThrow("head changed");
    expect(f.core.setOutput).not.toHaveBeenCalled();
  });

  test.each(["20", "21", "1", ""])(
    "never emits deployment reuse proof for exit %s",
    async (code) => {
      vi.stubEnv("DEPLOY_EXIT_CODE", code);
      vi.mocked(writeFile).mockClear();
      await expect(recordDeployment(fixture())).rejects.toThrow("Only successful");
      expect(writeFile).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    },
  );

  test("binds the successful receipt to the candidate, command and deployment attempt", async () => {
    for (const [key, value] of Object.entries({
      DEPLOY_EXIT_CODE: "0",
      CANDIDATE_DIR: "/fixture",
      GITHUB_RUN_ID: "31",
      GITHUB_RUN_ATTEMPT: "2",
      CANDIDATE_ARTIFACT_ID: "99",
      OCI_COMMAND_ID: "ocid1.instanceagentcommand.test.fixture",
    }))
      vi.stubEnv(key, value);
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(candidate));
    vi.mocked(writeFile).mockClear();
    await recordDeployment(fixture());
    expect(writeFile).toHaveBeenCalledWith(
      "/fixture/receipt.json",
      expect.stringContaining('"candidateArtifactId":99'),
    );
    vi.unstubAllEnvs();
  });

  test("resolves only the verified pre-merge artifact for the current squash result", async () => {
    const f = fixture();
    await resolvePromotion(f);
    expect(f.core.setOutput).toHaveBeenCalledWith("artifact_id", 99);
    expect(f.core.setOutput).toHaveBeenCalledWith("source_sha", sourceSha);
    expect(f.github.rest.actions.listWorkflowRuns).toHaveBeenCalledWith(
      expect.objectContaining({ head_sha: sourceSha }),
    );
  });

  test("resolves cleared post-merge associations while retaining exact candidate PR validation", async () => {
    const f = fixture();
    f.github.rest.actions.listWorkflowRuns.mockResolvedValue({
      data: { workflow_runs: [{ ...run, pull_requests: [] }] },
    });
    await resolvePromotion(f);
    expect(f.core.setOutput).toHaveBeenCalledWith("artifact_id", 99);
    expect(() => assertCandidate({ ...candidate, prNumber: 999 }, candidate)).toThrow(
      "Candidate prNumber mismatch",
    );
  });

  test.each([
    "unmerged",
    "head",
    "tree",
    "not-squash",
    "superseded",
    "expired",
    "missing",
    "late-check",
    "failed-check",
  ])("rejects %s before handing off any digest", async (failure) => {
    const f = fixture();
    if (failure === "unmerged") f.livePr.merged = false;
    if (failure === "head") f.livePr.head.sha = "e".repeat(40);
    if (failure === "tree")
      f.github.rest.git.getCommit
        .mockResolvedValueOnce({ data: { tree: { sha: sourceTree }, parents: [{}] } })
        .mockResolvedValueOnce({ data: { tree: { sha: "f".repeat(40) }, parents: [{}] } });
    if (failure === "not-squash")
      f.github.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: sourceTree }, parents: [{}, {}] },
      });
    if (failure === "superseded")
      f.github.rest.repos.getBranch.mockResolvedValue({
        data: { commit: { sha: "f".repeat(40) } },
      });
    if (failure === "expired") f.artifacts[0].expired = true;
    if (failure === "missing") f.artifacts.splice(0);
    if (failure === "late-check") f.jobs[0].completed_at = "2026-10-05T10:11:00Z";
    if (failure === "failed-check") f.jobs[1].conclusion = "failure";
    await expect(resolvePromotion(f)).rejects.toThrow();
    expect(f.core.setOutput).not.toHaveBeenCalled();
  });

  test("keeps migration pushes out of verification and build out of deployment", async () => {
    const verify = await readFile(".github/workflows/verify.yml", "utf8");
    const deploy = await readFile(".github/workflows/deploy-promotion.yml", "utf8");
    const push = verify.slice(verify.indexOf("  push:"), verify.indexOf("concurrency:"));
    expect(push).toContain("- main");
    expect(push).toContain("- develop");
    expect(push).not.toContain("migration_");
    expect(deploy).toContain("types: [closed]");
    expect(deploy).not.toContain("docker/build-push-action");
    expect(deploy).not.toContain("pnpm build");
    expect(deploy).not.toContain("docker/login-action");
  });

  test.each([0, 20, 21])("deploys the verified pair and preserves exit %s", async (exitCode) => {
    const deploy = await readFile(".github/workflows/deploy-promotion.yml", "utf8");
    expect(deploy).not.toContain("Block deployment");
    const deployStep = deploy.slice(
      deploy.indexOf("      - name: Deploy immutable pair"),
      deploy.indexOf("      - name: Record successful paired deployment evidence"),
    );
    const script = deployStep.split("        run: |\n")[1].replace(/^          /gm, "");
    const adapter = `bash() {
      [[ "$#" == 4 && "$1" == ops/oci/deploy-via-run-command.sh &&
         "$2" == "$WEB_IMAGE_DIGEST" && "$3" == "$CONSOLE_IMAGE_DIGEST" &&
         "$4" == "$CANDIDATE_PAYLOAD" ]] || return 88
      echo verified_pair_forwarded
      return ${exitCode}
    }\n`;
    const result = spawnSync("bash", ["-c", adapter + script], {
      encoding: "utf8",
      env: {
        GITHUB_OUTPUT: "/dev/null",
        WEB_IMAGE_DIGEST: imageDigest,
        CONSOLE_IMAGE_DIGEST: `sha256:${"e".repeat(64)}`,
        CANDIDATE_PAYLOAD: "verified-candidate",
      },
    });
    expect(result.status).toBe(exitCode);
    expect(result.stdout).toContain("verified_pair_forwarded");
    expect(deploy.indexOf("Validate candidate identity")).toBeLessThan(
      deploy.indexOf("oracle-actions/run-oci-cli-command"),
    );
  });

  test.each([
    [
      "candidate",
      "failure",
      "success",
      "",
      "",
      "Web 게시: success / Console 게시: failure / 후보 검증: failure",
    ],
    ["deploy", "failure", "", "failure", "", "후보 기록 확인 실패"],
    ["deploy", "success", "", "failure", "20", "이전 릴리즈 복구 완료"],
    ["deploy", "success", "", "failure", "21", "자동 롤백 실패"],
    ["deploy", "success", "", "success", "0", "Health"],
    ["blocked", "success", "", "failure", "", "Run Command 미실행"],
  ])(
    "reports candidate/deployment phase accurately",
    (phase, checked, published, deployed, code, detail) => {
      const result = spawnSync("python3", ["ops/oci/slack-deploy-payload.py"], {
        encoding: "utf8",
        env: {
          ...process.env,
          PHASE: phase === "blocked" ? "deploy" : phase,
          DEPLOYMENT_BLOCKED: phase === "blocked" ? "true" : "false",
          CANDIDATE_RESULT: checked,
          PUBLISH_RESULT: published,
          DEPLOY_RESULT: deployed,
          DEPLOY_EXIT_CODE: code,
          SOURCE_SHA: sourceSha,
          IMAGE_DIGEST: imageDigest,
          CONSOLE_IMAGE_DIGEST: candidate.images.console.digest,
          CONSOLE_PUBLISH_RESULT: "failure",
          GITHUB_RUN_ID: "17",
          GITHUB_RUN_ATTEMPT: "1",
          RUN_URL: "https://example.invalid/run",
        },
      });
      expect(result.status, result.stderr).toBe(0);
      const payload = JSON.stringify(JSON.parse(result.stdout));
      expect(payload).toContain(detail);
      expect(payload).toContain("*Web*");
      expect(payload).toContain("*Console*");
      expect(payload).toContain("sha256:eeeeeeeeeeee…eeeeeeee");
      if (phase === "candidate") {
        expect(payload).toContain("Console 게시: failure");
        expect(payload).toContain("17/1");
      }
    },
  );
});
