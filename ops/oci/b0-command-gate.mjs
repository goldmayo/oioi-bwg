import { prepare } from "./promotion.mjs";

// A maintainer adds this source-bound attestation only after the root host probe passes.
export async function prepareCommand({ github, context, core }) {
  await prepare({ github, context, core });
  const pr = context.payload.pull_request;
  const { data: current } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: pr.number,
  });
  if (!current.labels.some(({ name }) => name === `b0-host-${pr.head.sha}`))
    throw new Error("Current source requires successful host pull and Secret checks");
  const { data } = await github.rest.actions.listWorkflowRuns({
    ...context.repo,
    workflow_id: "verify.yml",
    head_sha: pr.head.sha,
    event: "pull_request",
    per_page: 100,
  });
  const run = data.workflow_runs
    .filter(
      (item) =>
        item.head_sha === pr.head.sha &&
        item.head_branch === "migration_main" &&
        item.head_repository?.full_name === pr.head.repo.full_name &&
        item.pull_requests.some((pull) => pull.number === pr.number),
    )
    .sort((left, right) => right.id - left.id)[0];
  if (!run || run.status !== "completed")
    throw new Error("Latest B0 verification has not completed");
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
    ...context.repo,
    run_id: run.id,
    attempt_number: run.run_attempt,
    per_page: 100,
  });
  for (const name of ["verify", "B0 publish probe"])
    if (!jobs.some((job) => job.name === name && job.conclusion === "success"))
      throw new Error("Latest source requires successful verify and B0 publication");
}
