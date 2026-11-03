import { expect, test, vi } from "vitest";
import { verifyHistory, verifySource } from "../../ops/oci/source-verification.mjs";
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

function historyFixture() {
  const f = fixture();
  const ids = {
    base: "a".repeat(40),
    head: "b".repeat(40),
    develop: "c".repeat(40),
    source: "d".repeat(40),
    merged: "e".repeat(40),
  };
  f.pr.merge_commit_sha = ids.base;
  const pr = {
    number: 10,
    state: "open",
    draft: false,
    merged_at: "2026-11-03T02:00:00Z",
    merge_commit_sha: ids.merged,
    base: { ref: "migration_main", sha: ids.base },
    head: { sha: ids.head, ref: "feature/history", repo: { full_name: "owner/repo" } },
  };
  const promotion = {
    ...pr,
    merge_commit_sha: ids.develop,
    base: { ref: "migration_develop", sha: "old" },
    head: { ...pr.head, ref: "migration_main", sha: ids.source },
  };
  const commits: Record<string, { tree: { sha: string }; parents: { sha: string }[] }> = {
    [ids.head]: { tree: { sha: "tree" }, parents: [{ sha: ids.base }, { sha: ids.develop }] },
    [ids.base]: { tree: { sha: "tree" }, parents: [] },
    [ids.develop]: { tree: { sha: "deployed-tree" }, parents: [] },
    [ids.source]: { tree: { sha: "deployed-tree" }, parents: [] },
    [ids.merged]: { tree: { sha: "tree" }, parents: [{ sha: ids.base }, { sha: ids.head }] },
  };
  const branches = {
    migration_main: { commit: { sha: ids.base } },
    migration_develop: { commit: { sha: ids.develop } },
  };
  const comparison = { status: "ahead" };
  const historyRun = { ...f.run, id: 11, head_sha: ids.head, updated_at: "2026-11-03T01:59:00Z" };
  const historyJobs = [
    ...Object.values(verificationJobNames).map((name) => ({
      name,
      conclusion: "skipped",
      completed_at: "2026-11-03T01:58:00Z",
    })),
    { name: "verify", conclusion: "success", completed_at: "2026-11-03T01:58:00Z" },
    {
      name: "reuse main verification",
      conclusion: "success",
      completed_at: "2026-11-03T01:58:00Z",
    },
    {
      name: "changed files and affected workspaces",
      conclusion: "skipped",
      completed_at: "2026-11-03T01:58:00Z",
    },
  ];
  const github = {
    ...f.github,
    rest: {
      ...f.github.rest,
      repos: {
        listPullRequestsAssociatedWithCommit: vi.fn(async ({ commit_sha }) => {
          if (commit_sha === ids.develop) return [promotion];
          return commit_sha === ids.merged ? [pr] : [f.pr];
        }),
        getBranch: vi.fn(async ({ branch }: { branch: keyof typeof branches }) => ({
          data: branches[branch],
        })),
        compareCommitsWithBasehead: vi.fn(async () => ({ data: comparison })),
      },
      git: {
        getCommit: vi.fn(async ({ commit_sha }: { commit_sha: string }) => ({
          data: commits[commit_sha],
        })),
      },
      pulls: { get: vi.fn(async () => ({ data: pr })) },
      actions: {
        ...f.github.rest.actions,
        listWorkflowRuns: vi.fn(async ({ head_sha }) => ({
          data: { workflow_runs: [head_sha === ids.head ? historyRun : f.run] },
        })),
        listJobsForWorkflowRun: vi.fn(async ({ run_id }) => (run_id === 11 ? historyJobs : f.jobs)),
      },
    },
  };
  const context = {
    ...f.context,
    sha: ids.merged,
    payload: { pull_request: { number: 10, head: { sha: ids.head } } },
  };
  return {
    ...f,
    github,
    context,
    pr,
    promotion,
    commits,
    branches,
    comparison,
    historyRun,
    historyJobs,
    ids,
  };
}

test("파일 변경 없는 정상 이력 연결은 첫 부모의 전체 성공을 재사용한다", async () => {
  const f = historyFixture();
  expect(await verifyHistory(f)).toEqual({ sourceSha: f.ids.head, sourceTree: "tree", runId: 2 });
});

test("Promotion은 검증된 이력 연결을 거쳐 원래 전체 검증까지 대조한다", async () => {
  const f = historyFixture();
  f.pr.state = "closed";
  f.context.payload.pull_request.head.sha = f.ids.merged;
  expect(await verifySource(f)).toEqual({ sourceSha: f.ids.merged, sourceTree: "tree", runId: 2 });
});

test.each([
  "tree",
  "parent",
  "stale-main",
  "stale-develop",
  "fork",
  "draft",
  "promotion-tree",
  "promotion-fork",
  "diverged",
  "failed-proof",
])("이력 연결의 불일치 %s는 재사용하지 않는다", async (fault) => {
  const f = historyFixture();
  if (fault === "tree") f.commits[f.ids.head].tree.sha = "different";
  if (fault === "parent") f.commits[f.ids.head].parents.pop();
  if (fault === "stale-main") f.branches.migration_main.commit.sha = "other";
  if (fault === "stale-develop") f.branches.migration_develop.commit.sha = "other";
  if (fault === "fork") f.pr.head.repo.full_name = "fork/repo";
  if (fault === "draft") f.pr.draft = true;
  if (fault === "promotion-tree") f.commits[f.ids.source].tree.sha = "changed";
  if (fault === "promotion-fork") f.promotion.head.repo = { full_name: "fork/repo" };
  if (fault === "diverged") f.comparison.status = "diverged";
  if (fault === "failed-proof") f.run.conclusion = "failure";
  await expect(verifyHistory(f)).rejects.toThrow();
  expect(f.core.setOutput).not.toHaveBeenCalled();
});

test("병합 뒤 부모 유실 또는 재사용 job 실패를 Promotion 근거로 삼지 않는다", async () => {
  for (const fault of ["parents", "job"]) {
    const f = historyFixture();
    f.context.payload.pull_request.head.sha = f.ids.merged;
    if (fault === "parents") f.commits[f.ids.merged].parents.pop();
    else
      f.historyJobs.find((job) => job.name === "reuse main verification")!.conclusion = "failure";
    await expect(verifySource(f)).rejects.toThrow();
  }
});
