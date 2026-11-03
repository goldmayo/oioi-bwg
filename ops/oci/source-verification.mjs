import { docsOnly, verificationJobNames } from "../../scripts/verification-scope.mjs";
import { prepare } from "./promotion.mjs";

const fullJobs = Object.values(verificationJobNames);

// Reuse successful code checks, never a build cache or a deployment candidate.
export async function verifySource({ github, context, core }) {
  const tree = await prepare({ github, context, core });
  const head = context.payload.pull_request.head.sha;
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  const prs = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
    ...context.repo,
    commit_sha: head,
    per_page: 100,
  });
  const pr = prs.find(
    (item) =>
      item.merged_at &&
      item.merge_commit_sha === head &&
      item.base.ref === "migration_main" &&
      item.head.repo?.full_name === repository,
  );
  if (!pr) throw new Error("Source has no merged migration_main PR verification");
  const { data } = await github.rest.actions.listWorkflowRuns({
    ...context.repo,
    workflow_id: "verify.yml",
    event: "pull_request",
    head_sha: pr.head.sha,
    per_page: 100,
  });
  const run = data.workflow_runs
    .filter(
      (item) =>
        item.event === "pull_request" &&
        item.path === ".github/workflows/verify.yml" &&
        item.head_sha === pr.head.sha &&
        item.head_commit?.tree_id === tree &&
        item.head_repository?.full_name === repository &&
        Date.parse(item.updated_at) <= Date.parse(pr.merged_at),
    )
    .sort((a, b) => b.id - a.id)[0];
  if (!run || run.status !== "completed" || run.conclusion !== "success")
    throw new Error("Source verification is missing, changed or unsuccessful");
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
    ...context.repo,
    run_id: run.id,
    filter: "latest",
    per_page: 100,
  });
  const result = (name) => {
    const matches = jobs.filter((job) => job.name === name);
    if (matches.length !== 1 || !(Date.parse(matches[0].completed_at) <= Date.parse(pr.merged_at)))
      throw new Error(`Missing or ambiguous source check: ${name}`);
    return matches[0].conclusion;
  };
  if (result("verify") !== "success") throw new Error("Source verify did not pass");
  const full = fullJobs.every((name) => result(name) === "success");
  const docs =
    !full &&
    fullJobs.every((name) => result(name) === "skipped") &&
    docsOnly({ eventName: "pull_request", event: { pull_request: pr }, fetchSource: true });
  if (!full && !docs)
    throw new Error("Source lacks complete code checks or proven Markdown-only scope");
  core.info(`Reuse main PR #${pr.number}, Verify ${run.id}, source ${head}, tree ${tree}`);
  core.setOutput("verification_run_id", run.id);
  return { sourceSha: head, sourceTree: tree, runId: run.id };
}
