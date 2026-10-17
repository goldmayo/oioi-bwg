import assert from "node:assert/strict";
import { prepareCommand } from "../../ops/oci/b0-command-gate.mjs";
const sha = "a".repeat(40),
  tree = "b".repeat(40),
  repository = "fixture/repo";
function fixture(variant) {
  const pr = {
    number: 1,
    state: "open",
    head: { sha, ref: "migration_main", repo: { full_name: repository } },
    base: { ref: "migration_develop" },
    labels: [{ name: `b0-host-${sha}` }],
  };
  if (variant === "stale-attestation") pr.labels = [{ name: `b0-host-${"c".repeat(40)}` }];
  const run = {
    id: 2,
    status: "completed",
    conclusion: "failure",
    head_sha: sha,
    head_branch: "migration_main",
    head_repository: { full_name: repository },
    pull_requests: [{ number: 1 }],
    run_attempt: 1,
  };
  if (variant === "unrelated-run") run.pull_requests = [{ number: 2 }];
  let jobs = [
    { name: "verify", conclusion: "success" },
    { name: "B0 publish probe", conclusion: "success" },
  ];
  if (variant === "failed-publish") jobs[1].conclusion = "failure";
  const runs = [run];
  if (variant === "latest-incomplete") runs.push({ ...run, id: 3, status: "in_progress" });
  const github = {
    rest: {
      pulls: { get: async () => ({ data: pr }) },
      repos: { getBranch: async () => ({ data: { commit: { sha } } }) },
      git: {
        getCommit: async ({ commit_sha }) => ({
          data: {
            tree: { sha: variant === "wrong-tree" && commit_sha !== sha ? "d".repeat(40) : tree },
          },
        }),
      },
      actions: {
        listWorkflowRuns: async () => ({ data: { workflow_runs: runs } }),
        listJobsForWorkflowRunAttempt() {},
      },
    },
    paginate: async () => jobs,
  };
  return {
    github,
    context: {
      repo: { owner: "fixture", repo: "repo" },
      sha: "c".repeat(40),
      payload: { pull_request: pr },
    },
    core: { setOutput() {} },
  };
}
await prepareCommand(fixture("ok"));
for (const variant of [
  "stale-attestation",
  "unrelated-run",
  "failed-publish",
  "latest-incomplete",
  "wrong-tree",
])
  await assert.rejects(() => prepareCommand(fixture(variant)));
console.log("B0 command gate: success and 5 refusal cases passed");
