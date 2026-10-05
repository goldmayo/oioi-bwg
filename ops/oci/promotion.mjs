import { writeFile } from "node:fs/promises";

const sha = /^[0-9a-f]{40}$/;
const digest = /^sha256:[0-9a-f]{64}$/;

export function assertPromotion(pr, repository) {
  if (
    pr.base.ref !== "migration_develop" ||
    pr.head.ref !== "migration_main" ||
    pr.head.repo?.full_name !== repository
  ) {
    throw new Error(
      "Only same-repository migration_main → migration_develop promotions are allowed",
    );
  }
}

export function assertSameTree(source, merged) {
  if (!sha.test(source) || source !== merged)
    throw new Error("Promotion source/merge tree mismatch");
}

export function assertCandidate(candidate, expected) {
  if (
    !sha.test(candidate.sourceSha) ||
    !sha.test(candidate.sourceTree) ||
    !/^[a-z0-9.-]+\/[a-z0-9._/-]+$/.test(candidate.imageRepository) ||
    ![candidate.prNumber, candidate.runId, candidate.runAttempt].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  ) {
    throw new Error("Invalid candidate source or run identity");
  }
  for (const key of [
    "prNumber",
    "sourceSha",
    "sourceTree",
    "runId",
    "runAttempt",
    "imageRepository",
  ]) {
    if (candidate[key] !== expected[key]) throw new Error(`Candidate ${key} mismatch`);
  }
  if (!digest.test(candidate.imageDigest))
    throw new Error("Candidate requires an immutable digest");
}

export function selectCandidateRun(runs, pr) {
  const run = runs
    .filter(
      (item) =>
        item.event === "pull_request" &&
        item.head_sha === pr.head.sha &&
        item.head_branch === "migration_main" &&
        item.head_repository?.full_name === pr.head.repo.full_name &&
        // GitHub can clear associations after merge; candidate.json still binds the exact PR.
        (item.pull_requests.length === 0 ||
          item.pull_requests.some((pull) => pull.number === pr.number)) &&
        Date.parse(item.created_at) <= Date.parse(pr.merged_at),
    )
    .sort((left, right) => right.id - left.id)[0];
  if (!run || run.status !== "completed" || run.conclusion !== "success") {
    throw new Error("Latest promotion run did not succeed before merge");
  }
  return run;
}

export async function prepare({ github, context, core }) {
  const eventPr = context.payload.pull_request;
  assertPromotion(eventPr, context.repo.owner + "/" + context.repo.repo);
  const { data: pr } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: eventPr.number,
  });
  const { data: branch } = await github.rest.repos.getBranch({
    ...context.repo,
    branch: "migration_main",
  });
  if (
    pr.state !== "open" ||
    pr.head.sha !== eventPr.head.sha ||
    branch.commit.sha !== pr.head.sha
  ) {
    throw new Error("Promotion head changed; verify and build the new head");
  }
  const { data: source } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: pr.head.sha,
  });
  const { data: verified } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: context.sha,
  });
  assertSameTree(source.tree.sha, verified.tree.sha);
  core.setOutput("source_sha", pr.head.sha);
  core.setOutput("source_tree", source.tree.sha);
  return source.tree.sha;
}

export async function record({ github, context, core }) {
  const sourceTree = await prepare({ github, context, core });
  const candidate = {
    prNumber: context.payload.pull_request.number,
    sourceSha: context.payload.pull_request.head.sha,
    sourceTree,
    runId: Number(process.env.GITHUB_RUN_ID),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    imageRepository: process.env.IMAGE_REPOSITORY,
    imageDigest: process.env.IMAGE_DIGEST,
  };
  assertCandidate(candidate, candidate);
  await writeFile("candidate.json", JSON.stringify(candidate) + "\n");
}

export async function resolve({ github, context, core }) {
  const eventPr = context.payload.pull_request;
  assertPromotion(eventPr, context.repo.owner + "/" + context.repo.repo);
  const { data: pr } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: eventPr.number,
  });
  if (
    !pr.merged ||
    pr.head.sha !== eventPr.head.sha ||
    pr.merge_commit_sha !== eventPr.merge_commit_sha
  ) {
    throw new Error("Merged promotion identity mismatch");
  }
  const { data: branch } = await github.rest.repos.getBranch({
    ...context.repo,
    branch: "migration_develop",
  });
  if (branch.commit.sha !== pr.merge_commit_sha)
    throw new Error("Promotion was superseded by a newer merge");
  const { data: source } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: pr.head.sha,
  });
  const { data: merged } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: pr.merge_commit_sha,
  });
  if (merged.parents.length !== 1) throw new Error("Promotion must use squash merge");
  assertSameTree(source.tree.sha, merged.tree.sha);
  const { data } = await github.rest.actions.listWorkflowRuns({
    ...context.repo,
    workflow_id: "verify.yml",
    head_sha: pr.head.sha,
    event: "pull_request",
    per_page: 100,
  });
  const run = selectCandidateRun(data.workflow_runs, pr);
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
    ...context.repo,
    run_id: run.id,
    attempt_number: run.run_attempt,
    per_page: 100,
  });
  for (const name of ["verify", "promotion", "promotion candidate"]) {
    if (
      !jobs.some(
        (job) =>
          job.name === name &&
          job.conclusion === "success" &&
          Date.parse(job.completed_at) <= Date.parse(pr.merged_at),
      )
    ) {
      throw new Error(`Missing successful pre-merge ${name} check`);
    }
  }
  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
    ...context.repo,
    run_id: run.id,
    per_page: 100,
  });
  const artifact = artifacts.find(
    (item) =>
      item.name === `promotion-${pr.head.sha}-${run.run_attempt}` &&
      !item.expired &&
      Date.parse(item.created_at) <= Date.parse(pr.merged_at),
  );
  if (!artifact) throw new Error("Verified candidate artifact is missing or expired");
  for (const [key, value] of Object.entries({
    artifact_id: artifact.id,
    run_id: run.id,
    run_attempt: run.run_attempt,
    source_sha: pr.head.sha,
    source_tree: source.tree.sha,
    merged_sha: pr.merge_commit_sha,
  }))
    core.setOutput(key, value);
}
