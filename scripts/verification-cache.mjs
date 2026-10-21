import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export function cacheKey() {
  const index = execFileSync("git", ["ls-files", "-s", "--", ".", ":(exclude)docs/**"]);
  return `Linux-verify-amd64-v2-${createHash("sha256").update(index).digest("hex")}`;
}

// Cache is optional build input, never evidence that a new run passed verification.
export async function findMergedCache({ github, context, core, key = cacheKey(), tree }) {
  const branch = context.ref?.replace(/^refs\/heads\//, "");
  if (context.eventName !== "push" || !["migration_main", "migration_develop"].includes(branch))
    return;
  tree ??= execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  const prs = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
    ...context.repo,
    commit_sha: context.sha,
    per_page: 100,
  });
  const pr = prs.find(
    (p) =>
      p.merged_at &&
      p.merge_commit_sha === context.sha &&
      p.base.ref === branch &&
      p.head.repo?.full_name === repository,
  );
  if (!pr) return core.info("No merged same-repository PR; leave shared cache unchanged");
  const { data } = await github.rest.actions.listWorkflowRuns({
    ...context.repo,
    workflow_id: "verify.yml",
    event: "pull_request",
    head_sha: pr.head.sha,
    status: "success",
    per_page: 100,
  });
  for (const run of data.workflow_runs) {
    if (
      run.event !== "pull_request" ||
      run.path !== ".github/workflows/verify.yml" ||
      run.head_sha !== pr.head.sha ||
      run.head_commit?.tree_id !== tree ||
      run.head_repository?.full_name !== repository ||
      run.status !== "completed" ||
      run.conclusion !== "success" ||
      !(Date.parse(run.updated_at) <= Date.parse(pr.merged_at))
    )
      continue;
    const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
      ...context.repo,
      run_id: run.id,
      filter: "latest",
      per_page: 100,
    });
    if (
      !["app build", "verify"].every((name) =>
        jobs.some((j) => j.name === name && j.conclusion === "success"),
      )
    )
      continue;
    const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
      ...context.repo,
      run_id: run.id,
      per_page: 100,
    });
    const matches = artifacts.filter(
      (a) =>
        a.name === `ci-build-cache-${key}` &&
        a.expired === false &&
        Date.parse(a.expires_at) > Date.now() &&
        Date.parse(a.created_at) <= Date.parse(pr.merged_at),
    );
    if (matches.length !== 1) continue;
    core.setOutput("artifact_id", matches[0].id);
    core.setOutput("run_id", run.id);
    core.setOutput("key", key);
    core.info(`Publish cache from merged PR #${pr.number}, Verify ${run.id}: ${key}`);
    return;
  }
  core.info("No successful matching build cache artifact; leave shared cache unchanged");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(`key=${cacheKey()}`);
