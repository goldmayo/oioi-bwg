import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { describe, expect, test, vi } from "vitest";

import {
  assertCandidate,
  assertPromotion,
  assertSameTree,
  prepare,
  resolve as resolvePromotion,
  selectCandidateRun,
} from "../../ops/oci/promotion.mjs";

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
  imageDigest,
  imageRepository: "registry.example/namespace/web",
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
  const core = { setOutput: vi.fn() };
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

  test.each(["sourceSha", "sourceTree", "prNumber", "runId", "runAttempt", "imageRepository"])(
    "rejects a mismatched %s",
    (key) => {
      const value =
        typeof candidate[key as keyof typeof candidate] === "number" ? 999 : "e".repeat(40);
      expect(() => assertCandidate({ ...candidate, [key]: value }, candidate)).toThrow();
    },
  );

  test("requires immutable digest and exact source/merge tree", () => {
    expect(() => assertCandidate({ ...candidate, imageDigest: "latest" }, candidate)).toThrow();
    expect(() => assertSameTree(sourceTree, "f".repeat(40))).toThrow();
    expect(() => assertCandidate(candidate, candidate)).not.toThrow();
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

  test("resolves only the verified pre-merge artifact for the current squash result", async () => {
    const f = fixture();
    await resolvePromotion(f);
    expect(f.core.setOutput).toHaveBeenCalledWith("artifact_id", 99);
    expect(f.core.setOutput).toHaveBeenCalledWith("source_sha", sourceSha);
    expect(f.github.rest.actions.listWorkflowRuns).toHaveBeenCalledWith(
      expect.objectContaining({ head_sha: sourceSha }),
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

  test.each([
    ["candidate", "failure", "success", "", "", "이미지 게시: success / 후보 검증: failure"],
    ["deploy", "failure", "", "failure", "", "후보 기록 확인 실패"],
    ["deploy", "success", "", "failure", "20", "이전 릴리즈 복구 완료"],
    ["deploy", "success", "", "failure", "21", "자동 롤백 실패"],
    ["deploy", "success", "", "success", "0", "Health"],
  ])(
    "reports candidate/deployment phase accurately",
    (phase, checked, published, deployed, code, detail) => {
      const result = spawnSync("python3", ["ops/oci/slack-deploy-payload.py"], {
        encoding: "utf8",
        env: {
          ...process.env,
          PHASE: phase,
          CANDIDATE_RESULT: checked,
          PUBLISH_RESULT: published,
          DEPLOY_RESULT: deployed,
          DEPLOY_EXIT_CODE: code,
          SOURCE_SHA: sourceSha,
          IMAGE_DIGEST: imageDigest,
          RUN_URL: "https://example.invalid/run",
        },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.stringify(JSON.parse(result.stdout))).toContain(detail);
    },
  );
});
