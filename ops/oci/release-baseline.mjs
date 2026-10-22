import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

import { assertCandidate, buildConfigHash, releaseId } from "./promotion.mjs";

// Only a successful paired deployment receipt is a reuse source. Never search older
// artifacts/tags when the latest successful deployment has no usable evidence.
export async function findBaseline({ github, context, core }) {
  try {
    const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
      ...context.repo,
      workflow_id: "deploy-promotion.yml",
      event: "pull_request",
      status: "success",
      per_page: 100,
    });
    const run = runs
      .filter(
        (r) =>
          r.head_branch === "migration_main" &&
          r.head_repository?.full_name === `${context.repo.owner}/${context.repo.repo}`,
      )
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
    if (!run) return;
    const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
      ...context.repo,
      run_id: run.id,
      per_page: 100,
    });
    const matches = artifacts.filter(
      (a) => a.name === `paired-deployment-${run.id}-${run.run_attempt}` && !a.expired,
    );
    if (matches.length !== 1) return;
    core.setOutput("artifact_id", matches[0].id);
    core.setOutput("run_id", run.id);
    core.setOutput("run_attempt", run.run_attempt);
  } catch {
    core.info("Deployment evidence unavailable; rebuild both images");
  }
}

export async function validateBaseline({
  github,
  context,
  receipt,
  candidate,
  proof,
  repositories,
}) {
  assertCandidate(candidate, { ...candidate, images: repositories });
  if (
    receipt.releaseId !== releaseId(candidate) ||
    receipt.exitCode !== 0 ||
    receipt.runId !== proof.runId ||
    receipt.runAttempt !== proof.runAttempt ||
    !/^ocid1\.instanceagentcommand\.[a-z0-9.-]+$/.test(receipt.commandId) ||
    !/^[0-9a-f]{40}$/.test(receipt.mergedSha)
  )
    throw new Error("Invalid deployment receipt");
  const { data: run } = await github.rest.actions.getWorkflowRun({
    ...context.repo,
    run_id: proof.runId,
  });
  if (
    run.path !== ".github/workflows/deploy-promotion.yml" ||
    run.event !== "pull_request" ||
    run.head_branch !== "migration_main" ||
    run.head_sha !== candidate.sourceSha ||
    run.head_repository?.full_name !== `${context.repo.owner}/${context.repo.repo}` ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    run.run_attempt !== proof.runAttempt
  )
    throw new Error("Unsuccessful deployment evidence");
  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
    ...context.repo,
    run_id: run.id,
    per_page: 100,
  });
  const artifact = artifacts.find(
    (a) => a.id === proof.artifactId && a.name === `paired-deployment-${run.id}-${run.run_attempt}`,
  );
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
    ...context.repo,
    run_id: run.id,
    attempt_number: run.run_attempt,
    per_page: 100,
  });
  if (
    !artifact ||
    artifact.expired !== false ||
    !Number.isFinite(Date.parse(artifact.expires_at)) ||
    Date.parse(artifact.expires_at) <= Date.now() ||
    !jobs.some((j) => j.name === "deploy" && j.conclusion === "success")
  )
    throw new Error("Expired or incomplete deployment evidence");
  const { data: pr } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: candidate.prNumber,
  });
  // GitHub can associate an old run with the next PR for the same branch/SHA.
  // Bind the deployment to its immutable candidate/receipt, not run.pull_requests.
  if (
    !pr.merged ||
    pr.head.sha !== candidate.sourceSha ||
    pr.merge_commit_sha !== receipt.mergedSha ||
    pr.base.ref !== "migration_develop" ||
    pr.head.ref !== "migration_main" ||
    pr.head.repo?.full_name !== `${context.repo.owner}/${context.repo.repo}`
  )
    throw new Error("Deployment PR mismatch");
  const { data: source } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: candidate.sourceSha,
  });
  const { data: merged } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: receipt.mergedSha,
  });
  if (
    source.tree.sha !== candidate.sourceTree ||
    merged.tree.sha !== candidate.sourceTree ||
    merged.parents.length !== 1
  )
    throw new Error("Deployment tree mismatch");
  const { data: verification } = await github.rest.actions.getWorkflowRun({
    ...context.repo,
    run_id: candidate.runId,
  });
  if (
    verification.path !== ".github/workflows/verify.yml" ||
    verification.head_sha !== candidate.sourceSha ||
    verification.event !== "pull_request" ||
    verification.head_branch !== "migration_main" ||
    verification.head_repository?.full_name !== `${context.repo.owner}/${context.repo.repo}` ||
    verification.run_attempt !== candidate.runAttempt ||
    verification.conclusion !== "success"
  )
    throw new Error("Candidate verification mismatch");
  const verifiedArtifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
    ...context.repo,
    run_id: candidate.runId,
    per_page: 100,
  });
  const verified = verifiedArtifacts.find(
    (a) =>
      a.id === receipt.candidateArtifactId &&
      a.name === `promotion-${candidate.sourceSha}-${candidate.runAttempt}`,
  );
  const checks = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
    ...context.repo,
    run_id: candidate.runId,
    attempt_number: candidate.runAttempt,
    per_page: 100,
  });
  if (
    !verified ||
    verified.expired !== false ||
    !Number.isFinite(Date.parse(verified.expires_at)) ||
    !Number.isFinite(Date.parse(verified.created_at)) ||
    Date.parse(verified.expires_at) <= Date.now() ||
    Date.parse(verified.created_at) > Date.parse(pr.merged_at) ||
    !["verify", "promotion", "promotion candidate"].every((name) =>
      checks.some(
        (j) =>
          j.name === name &&
          j.conclusion === "success" &&
          Date.parse(j.completed_at) <= Date.parse(pr.merged_at),
      ),
    )
  )
    throw new Error("Candidate evidence missing or expired");
  return { ...proof, releaseId: receipt.releaseId };
}

/** @type {(file: string, args: string[], options: import('node:child_process').ExecFileSyncOptions) => string | Buffer} */
const executeImagePlanCommand = execFileSync;

export function planImages({
  baseline,
  proof,
  sourceSha,
  configHash = buildConfigHash(),
  execute = executeImagePlanCommand,
}) {
  const built = { web: true, console: true };
  if (!baseline || !proof) return { build: built, baseline: null };
  const result = { build: built, baseline: proof };
  try {
    assertCandidate(baseline, baseline);
    if (releaseId(baseline) !== proof.releaseId || baseline.buildConfigHash !== configHash)
      return result;
    execute("git", ["merge-base", "--is-ancestor", baseline.sourceSha, sourceSha], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const files = String(
      execute("git", ["diff", "--no-renames", "--name-only", "-z", baseline.sourceSha, sourceSha], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    )
      .split("\0")
      .filter(Boolean);
    // Root configuration, shared packages, lockfile, Dockerfile, workflows, or any
    // unknown path invalidate both. Turbo supplies the existing dependency graph.
    if (files.some((f) => !/^apps\/(web|console)\//.test(f))) return result;
    const dry = JSON.parse(
      String(
        execute("pnpm", ["exec", "turbo", "run", "build", "--affected", "--dry=json"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, TURBO_SCM_BASE: baseline.sourceSha, TURBO_SCM_HEAD: sourceSha },
        }),
      ),
    );
    if (
      !Array.isArray(dry.tasks) ||
      dry.tasks.some(
        (t) =>
          ![
            "@oioi-bwg/web",
            "@oioi-bwg/console",
            "@oioi-bwg/contracts",
            "@oioi-bwg/config",
            "@oioi-bwg/server",
          ].includes(t.package),
      )
    )
      return result;
    return {
      baseline: proof,
      build: Object.fromEntries(
        ["web", "console"].map((app) => [
          app,
          files.some((f) => f.startsWith(`apps/${app}/`)) ||
            dry.tasks.some((t) => t.package === `@oioi-bwg/${app}`),
        ]),
      ),
    };
  } catch {
    return result;
  }
}

export async function selectImages({ github, context, core }) {
  let baseline = null;
  let proof = null;
  const repositories = {
    web: { repository: process.env.IMAGE_REPOSITORY },
    console: { repository: process.env.CONSOLE_IMAGE_REPOSITORY },
  };
  try {
    const directory = process.env.BASELINE_DIR;
    const candidate = JSON.parse(await readFile(directory + "/candidate.json", "utf8"));
    const receipt = JSON.parse(await readFile(directory + "/receipt.json", "utf8"));
    proof = await validateBaseline({
      github,
      context,
      candidate,
      receipt,
      repositories,
      proof: {
        artifactId: Number(process.env.BASELINE_ARTIFACT_ID),
        runId: Number(process.env.BASELINE_RUN_ID),
        runAttempt: Number(process.env.BASELINE_RUN_ATTEMPT),
      },
    });
    baseline = candidate;
  } catch {
    core.info("No verified paired baseline; rebuild both images");
  }
  const sourceSha = context.payload.pull_request.head.sha;
  const plan = {
    ...planImages({ baseline, proof, sourceSha }),
    sourceSha,
    buildConfigHash: buildConfigHash(),
    images: {},
  };
  for (const app of ["web", "console"]) {
    const built = plan.build[app];
    plan.images[app] = {
      ...repositories[app],
      buildSourceSha: built ? sourceSha : baseline.images[app].buildSourceSha,
      origin: built ? "built" : "reused",
      ...(built ? {} : { digest: baseline.images[app].digest }),
    };
    core.setOutput(`build_${app}`, String(built));
    core.setOutput(`${app}_digest`, plan.images[app].digest || "");
    core.setOutput(`${app}_build_source_sha`, plan.images[app].buildSourceSha);
  }
  await writeFile(process.env.IMAGE_PLAN_FILE, JSON.stringify(plan) + "\n");
}
