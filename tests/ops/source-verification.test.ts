import { expect, test, vi } from "vitest";
import { verifySource } from "../../ops/oci/source-verification.mjs";
import { docsOnly, verificationJobNames } from "../../scripts/verification-scope.mjs";

vi.mock("../../ops/oci/promotion.mjs", () => ({ prepare: vi.fn(async () => "tree") }));
vi.mock("../../scripts/verification-scope.mjs", async (original) => ({
  ...(await original<typeof import("../../scripts/verification-scope.mjs")>()),
  docsOnly: vi.fn(() => false),
}));

function fixture() {
  vi.mocked(docsOnly).mockReturnValue(false);
  const context = {
    payload: { pull_request: { head: { sha: "merged" } } },
    repo: { owner: "owner", repo: "repo" },
  };
  const pr = {
    number: 1,
    merged_at: "2026-11-03T01:00:00Z",
    merge_commit_sha: "merged",
    base: { ref: "migration_main" },
    head: { sha: "source", repo: { full_name: "owner/repo" } },
  };
  const run = {
    id: 2,
    event: "pull_request",
    path: ".github/workflows/verify.yml",
    head_sha: "source",
    head_commit: { tree_id: "tree" },
    head_repository: { full_name: "owner/repo" },
    status: "completed",
    conclusion: "success",
    updated_at: "2026-11-03T00:59:00Z",
  };
  const jobs = [...Object.values(verificationJobNames), "verify"].map((name) => ({
    name,
    conclusion: "success",
    completed_at: "2026-11-03T00:58:00Z",
  }));
  const github = {
    rest: {
      repos: { listPullRequestsAssociatedWithCommit: vi.fn(async () => [pr]) },
      actions: {
        listWorkflowRuns: vi.fn(async () => ({ data: { workflow_runs: [run] } })),
        listJobsForWorkflowRun: vi.fn(async () => jobs),
      },
    },
    paginate: vi.fn((method, args) => method(args)),
  };
  const core = { info: vi.fn(), setOutput: vi.fn() };
  return { context, pr, run, jobs, github, core };
}

test("main 병합 당시 동일 source/tree의 전체 성공을 재사용한다", async () => {
  const f = fixture();
  await expect(verifySource(f)).resolves.toEqual({
    sourceSha: "merged",
    sourceTree: "tree",
    runId: 2,
  });
});

test.each([
  ["pr.merge_commit_sha", "other"],
  ["pr.base.ref", "migration_develop"],
  ["pr.head.repo.full_name", "fork/repo"],
  ["run.head_sha", "other"],
  ["run.head_commit.tree_id", "different"],
  ["run.head_repository.full_name", "fork/repo"],
  ["run.event", "push"],
  ["run.path", ".github/workflows/other.yml"],
  ["run.conclusion", "failure"],
  ["run.status", "in_progress"],
  ["run.updated_at", "2026-11-03T01:01:00Z"],
  ["jobs.0.conclusion", "failure"],
  ["jobs.0.conclusion", "skipped"],
  ["jobs.0.completed_at", "2026-11-03T01:01:00Z"],
  ["jobs.7.name", "partial verify"],
])("불일치·실패·부분 검증을 거절한다: %s", async (path, value) => {
  const f = fixture();
  const parts = path.split(".");
  let target = f as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>;
  target[parts.at(-1)!] = value;
  await expect(verifySource(f)).rejects.toThrow();
  expect(f.core.setOutput).not.toHaveBeenCalled();
});

test("누락·중복 job과 docs로 위장한 생략을 거절한다", async () => {
  for (const change of ["missing", "duplicate", "skipped"]) {
    const f = fixture();
    if (change === "missing") f.jobs.shift();
    if (change === "duplicate") f.jobs.push(f.jobs[0]);
    if (change === "skipped") for (const job of f.jobs.slice(0, -1)) job.conclusion = "skipped";
    await expect(verifySource(f)).rejects.toThrow();
  }
});

test("일반 .md만 바뀐 기존 main 예외는 Git diff를 재판정해야 재사용한다", async () => {
  const f = fixture();
  for (const job of f.jobs.slice(0, -1)) job.conclusion = "skipped";
  vi.mocked(docsOnly).mockReturnValue(true);
  await expect(verifySource(f)).resolves.toHaveProperty("runId", 2);
  expect(docsOnly).toHaveBeenCalledWith({
    eventName: "pull_request",
    event: { pull_request: f.pr },
    fetchSource: true,
  });
});
