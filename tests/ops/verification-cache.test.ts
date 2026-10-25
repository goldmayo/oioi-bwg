import { describe, expect, it, vi } from "vitest";

import { findMergedCache } from "../../scripts/verification-cache.mjs";

function fixture() {
  const key = "Linux-verify-amd64-v4-input";
  const context = {
    eventName: "push",
    ref: "refs/heads/migration_main",
    sha: "merged",
    repo: { owner: "owner", repo: "repo" },
  };
  const pr = {
    number: 42,
    merged_at: "2026-10-21T06:00:00Z",
    merge_commit_sha: "merged",
    base: { ref: "migration_main" },
    head: { sha: "source", repo: { full_name: "owner/repo" } },
  };
  const run = {
    id: 100,
    event: "pull_request",
    path: ".github/workflows/verify.yml",
    head_sha: "source",
    head_commit: { tree_id: "tree" },
    head_repository: { full_name: "owner/repo" },
    status: "completed",
    conclusion: "success",
    updated_at: "2026-10-21T05:59:00Z",
  };
  const artifact = {
    id: 200,
    name: `ci-build-cache-${key}`,
    expired: false,
    created_at: "2026-10-21T05:58:00Z",
    expires_at: "2099-01-01T00:00:00Z",
  };
  const jobs = ["app build", "verify"].map((name) => ({ name, conclusion: "success" }));
  const github = {
    rest: {
      repos: { listPullRequestsAssociatedWithCommit: vi.fn().mockResolvedValue([pr]) },
      actions: {
        listWorkflowRuns: vi.fn().mockResolvedValue({ data: { workflow_runs: [run] } }),
        listJobsForWorkflowRun: vi.fn().mockResolvedValue(jobs),
        listWorkflowRunArtifacts: vi.fn().mockResolvedValue([artifact]),
      },
    },
    paginate: vi.fn((method, args) => method(args)),
  };
  const core = { info: vi.fn(), setOutput: vi.fn() };
  return { context, pr, run, artifact, jobs, github, core, key, tree: "tree" };
}

describe("merged PR cache publication", () => {
  it("publishes the successful merged tree using the original content key", async () => {
    const f = fixture();
    await findMergedCache(f);
    expect(f.core.setOutput.mock.calls).toEqual([
      ["artifact_id", 200],
      ["run_id", 100],
      ["key", f.key],
    ]);
    expect(f.github.rest.actions.listWorkflowRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_id: "verify.yml",
        head_sha: "source",
        event: "pull_request",
        status: "success",
      }),
    );
  });

  it("also publishes Promotion cache under migration_develop", async () => {
    const f = fixture();
    f.context.ref = "refs/heads/migration_develop";
    f.pr.base.ref = "migration_develop";
    await findMergedCache(f);
    expect(f.core.setOutput).toHaveBeenCalledWith("artifact_id", 200);
  });

  it.each([
    ["context.eventName", "pull_request"],
    ["context.ref", "refs/heads/feature/test"],
    ["pr.merged_at", ""],
    ["pr.merge_commit_sha", "other"],
    ["pr.base.ref", "main"],
    ["pr.head.repo.full_name", "fork/repo"],
    ["run.head_sha", "old"],
    ["run.head_commit.tree_id", "old"],
    ["run.head_repository.full_name", "fork/repo"],
    ["run.path", ".github/workflows/other.yml"],
    ["run.event", "workflow_dispatch"],
    ["run.conclusion", "failure"],
    ["run.status", "in_progress"],
    ["run.updated_at", "2026-10-21T06:01:00Z"],
    ["run.updated_at", ""],
    ["jobs.1.conclusion", "failure"],
    ["jobs.0.conclusion", "skipped"],
    ["artifact.name", "different-input"],
    ["artifact.expired", true],
    ["artifact.expires_at", "2020-01-01T00:00:00Z"],
    ["artifact.expires_at", ""],
    ["artifact.created_at", "2026-10-21T06:01:00Z"],
  ])("rejects changed %s = %s", async (path, value) => {
    const f = fixture();
    const parts = String(path).split(".");
    let target = f as unknown as Record<string, unknown>;
    for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>;
    target[parts.at(-1)!] = value;
    await findMergedCache(f);
    expect(f.core.setOutput).not.toHaveBeenCalled();
  });

  it.each([{ artifacts: [] }, { artifacts: [fixture().artifact, fixture().artifact] }])(
    "ignores missing or ambiguous artifacts %j",
    async ({ artifacts }) => {
      const f = fixture();
      f.github.rest.actions.listWorkflowRunArtifacts.mockResolvedValue(artifacts);
      await findMergedCache(f);
      expect(f.core.setOutput).not.toHaveBeenCalled();
    },
  );
});
