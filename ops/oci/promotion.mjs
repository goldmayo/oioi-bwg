import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";

const sha = /^[0-9a-f]{40}$/;
const digest = /^sha256:[0-9a-f]{64}$/;

export function assertPromotion(pr, repository) {
  if (
    pr.base.ref !== "develop" ||
    pr.head.ref !== "main" ||
    pr.head.repo?.full_name !== repository
  ) {
    throw new Error("Only same-repository main → develop promotions are allowed");
  }
}

export function assertSameTree(source, merged) {
  if (!sha.test(source) || source !== merged)
    throw new Error("Promotion source/merge tree mismatch");
}

export function buildConfigHash(env = process.env) {
  return releaseId(
    Object.fromEntries(
      [
        "NEXT_PUBLIC_APP_ENV",
        "NEXT_PUBLIC_GTM_ID",
        "NEXT_PUBLIC_SENTRY_DSN",
        "SENTRY_ORG",
        "SENTRY_PROJECT",
        "SENTRY_SOURCE_MAPS_ENABLED",
      ].map((key) => [key, env[key] || ""]),
    ),
  );
}

export function releaseId(candidate) {
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          )
        : value;
  return createHash("sha256")
    .update(JSON.stringify(canonical(candidate)))
    .digest("hex");
}

export function assertCandidate(candidate, expected) {
  if (
    !candidate ||
    Object.keys(candidate).sort().join(",") !==
      "baseline,buildConfigHash,images,prNumber,runAttempt,runId,sourceSha,sourceTree"
  )
    throw new Error("Invalid candidate fields");
  if (
    !sha.test(candidate.sourceSha) ||
    !sha.test(candidate.sourceTree) ||
    ![candidate.prNumber, candidate.runId, candidate.runAttempt].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  ) {
    throw new Error("Invalid candidate source or run identity");
  }
  for (const key of ["prNumber", "sourceSha", "sourceTree", "runId", "runAttempt"]) {
    if (candidate[key] !== expected[key]) throw new Error(`Candidate ${key} mismatch`);
  }
  if (!/^[0-9a-f]{64}$/.test(candidate.buildConfigHash))
    throw new Error("Invalid build configuration proof");
  if (
    candidate.baseline !== null &&
    (!candidate.baseline ||
      Object.keys(candidate.baseline).sort().join(",") !==
        "artifactId,releaseId,runAttempt,runId" ||
      !/^[0-9a-f]{64}$/.test(candidate.baseline.releaseId) ||
      ![
        candidate.baseline.artifactId,
        candidate.baseline.runId,
        candidate.baseline.runAttempt,
      ].every((n) => Number.isSafeInteger(n) && n > 0))
  )
    throw new Error("Invalid deployment baseline proof");
  if (!candidate.images || Object.keys(candidate.images).sort().join(",") !== "console,web")
    throw new Error("Candidate requires exactly Web and Console images");
  for (const app of ["web", "console"]) {
    const image = candidate.images[app];
    if (
      !image ||
      Object.keys(image).sort().join(",") !== "buildSourceSha,digest,origin,repository" ||
      !/^[a-z0-9.-]+(?:\/[a-z0-9._-]+)+$/.test(image.repository) ||
      image.repository !== expected.images[app].repository
    )
      throw new Error(`Candidate ${app} repository mismatch`);
    if (
      !sha.test(image.buildSourceSha) ||
      !["built", "reused"].includes(image.origin) ||
      (image.origin === "built" && image.buildSourceSha !== candidate.sourceSha) ||
      (image.origin === "reused" && !candidate.baseline)
    )
      throw new Error(`Invalid ${app} build provenance`);
    if (!digest.test(image.digest))
      throw new Error(`Candidate ${app} requires an immutable digest`);
  }
  if (candidate.images.web.repository === candidate.images.console.repository)
    throw new Error("Candidate repositories must be distinct");
}

export function selectCandidateRun(runs, pr) {
  const run = runs
    .filter(
      (item) =>
        item.event === "pull_request" &&
        item.head_sha === pr.head.sha &&
        item.head_branch === "main" &&
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
  assertPromotion(pr, context.repo.owner + "/" + context.repo.repo);
  const { data: branch } = await github.rest.repos.getBranch({
    ...context.repo,
    branch: "main",
  });
  if (
    pr.state !== "open" ||
    pr.draft ||
    pr.head.sha !== eventPr.head.sha ||
    branch.commit.sha !== pr.head.sha
  ) {
    throw new Error("Promotion head changed; verify and build the new head");
  }
  const { data: base } = await github.rest.repos.getBranch({
    ...context.repo,
    branch: "develop",
  });
  if (
    !sha.test(eventPr.base.sha) ||
    pr.base.sha !== eventPr.base.sha ||
    base.commit.sha !== eventPr.base.sha
  )
    throw new Error("Promotion base changed; start verification for the current base");
  const { data: source } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: pr.head.sha,
  });
  const { data: verified } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: context.sha,
  });
  if (
    verified.parents.length !== 2 ||
    verified.parents[0].sha !== eventPr.base.sha ||
    verified.parents[1].sha !== pr.head.sha
  )
    throw new Error("Promotion verification merge parents mismatch");
  assertSameTree(source.tree.sha, verified.tree.sha);
  core.setOutput("source_sha", pr.head.sha);
  core.setOutput("source_tree", source.tree.sha);
  return source.tree.sha;
}

export function collectImages(plan, results, expected) {
  if (plan.sourceSha !== expected.sourceSha || plan.buildConfigHash !== expected.buildConfigHash)
    throw new Error("Image plan source/configuration changed");
  const selected = ["web", "console"].filter((app) => plan.build[app] === true);
  if (results.length !== selected.length) throw new Error("Image results are incomplete");
  const images = { web: plan.images.web, console: plan.images.console };
  for (const app of ["web", "console"]) {
    if (typeof plan.build[app] !== "boolean") throw new Error("Invalid image selection");
    const image = plan.images[app];
    if (plan.build[app]) {
      const matches = results.filter((result) => result.app === app);
      if (matches.length !== 1 || image.origin !== "built") throw new Error("Invalid image result");
      const result = matches[0];
      if (
        Object.keys(result).sort().join(",") !==
        "app,buildConfigHash,digest,repository,runAttempt,runId,sourceSha,sourceTree"
      )
        throw new Error("Invalid image result fields");
      for (const key of ["sourceSha", "sourceTree", "buildConfigHash", "runId", "runAttempt"])
        if (result[key] !== expected[key]) throw new Error("Image build provenance changed");
      if (result.repository !== image.repository) throw new Error("Image build repository changed");
      images[app] = { ...image, digest: result.digest };
    } else {
      if (image.origin !== "reused") throw new Error("Missing reused image");
      images[app] = image;
    }
  }
  const candidate = { ...expected, baseline: plan.baseline, images };
  assertCandidate(candidate, expected);
  return images;
}

export async function recordImage({ github, context, core }) {
  const sourceTree = await prepare({ github, context, core });
  const app = process.env.BUILD_APP;
  if (!["web", "console"].includes(app) || !digest.test(process.env.IMAGE_DIGEST ?? ""))
    throw new Error("Invalid built image");
  const result = {
    app,
    digest: process.env.IMAGE_DIGEST,
    repository: process.env.BUILT_IMAGE_REPOSITORY,
    sourceSha: context.payload.pull_request.head.sha,
    sourceTree,
    buildConfigHash: buildConfigHash(),
    runId: Number(process.env.GITHUB_RUN_ID),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
  };
  await writeFile(`${app}.json`, JSON.stringify(result) + "\n");
}

export async function resolveImages({ github, context, core }) {
  const sourceTree = await prepare({ github, context, core });
  const plan = JSON.parse(await readFile(process.env.IMAGE_PLAN_FILE, "utf8"));
  const files = await readdir(process.env.IMAGE_RESULTS_DIR);
  if (files.some((file) => !["web.json", "console.json"].includes(file)))
    throw new Error("Unexpected image result artifact");
  const results = await Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(`${process.env.IMAGE_RESULTS_DIR}/${file}`, "utf8")),
    ),
  );
  const images = collectImages(plan, results, {
    prNumber: context.payload.pull_request.number,
    sourceSha: context.payload.pull_request.head.sha,
    sourceTree,
    buildConfigHash: buildConfigHash(),
    runId: Number(process.env.GITHUB_RUN_ID),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    images: {
      web: { repository: process.env.IMAGE_REPOSITORY },
      console: { repository: process.env.CONSOLE_IMAGE_REPOSITORY },
    },
  });
  for (const app of ["web", "console"]) {
    core.setOutput(`${app}_publish_result`, images[app].origin === "built" ? "success" : "reused");
    core.setOutput(`${app}_digest`, images[app].digest);
    core.setOutput(`${app}_build_source_sha`, images[app].buildSourceSha);
  }
}

export async function record({ github, context, core }) {
  const sourceTree = await prepare({ github, context, core });
  const candidate = {
    prNumber: context.payload.pull_request.number,
    sourceSha: context.payload.pull_request.head.sha,
    sourceTree,
    runId: Number(process.env.GITHUB_RUN_ID),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    baseline: null,
    buildConfigHash: buildConfigHash(),
    images: {
      web: {
        repository: process.env.IMAGE_REPOSITORY,
        digest: process.env.IMAGE_DIGEST,
        buildSourceSha: context.payload.pull_request.head.sha,
        origin: "built",
      },
      console: {
        repository: process.env.CONSOLE_IMAGE_REPOSITORY,
        digest: process.env.CONSOLE_IMAGE_DIGEST,
        buildSourceSha: context.payload.pull_request.head.sha,
        origin: "built",
      },
    },
  };
  if (process.env.IMAGE_PLAN_FILE) {
    const plan = JSON.parse(await readFile(process.env.IMAGE_PLAN_FILE, "utf8"));
    if (
      plan.sourceSha !== candidate.sourceSha ||
      plan.buildConfigHash !== candidate.buildConfigHash
    )
      throw new Error("Image plan source/configuration changed");
    candidate.baseline = plan.baseline;
    for (const app of ["web", "console"]) {
      const selected = plan.images[app];
      if (
        selected.repository !== candidate.images[app].repository ||
        (selected.origin === "reused" && selected.digest !== candidate.images[app].digest) ||
        plan.build[app] !== (selected.origin === "built")
      )
        throw new Error("Image plan provenance mismatch");
      candidate.images[app] = { ...selected, digest: candidate.images[app].digest };
    }
  }
  assertCandidate(candidate, candidate);
  const smoke = JSON.parse(await readFile(process.env.PAIR_SMOKE_FILE, "utf8"));
  if (
    smoke.runId !== candidate.runId ||
    smoke.runAttempt !== candidate.runAttempt ||
    !["web", "console"].every(
      (app) =>
        smoke.images?.[app]?.digest === candidate.images[app].digest &&
        smoke.images[app].buildSourceSha === candidate.images[app].buildSourceSha,
    )
  )
    throw new Error("Paired smoke proof mismatch");
  await writeFile("candidate.json", JSON.stringify(candidate) + "\n");
  await core.summary
    .addHeading("Verified paired candidate")
    .addTable([
      ["Source SHA", candidate.sourceSha],
      ["Source/merge tree", sourceTree],
      ["Candidate run/attempt", `${candidate.runId}/${candidate.runAttempt}`],
      ...Object.entries(candidate.images).map(([app, image]) => [
        app,
        `${image.repository}@${image.digest}`,
      ]),
    ])
    .write();
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
    branch: "develop",
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
  if (
    !sha.test(eventPr.base.sha) ||
    pr.base.sha !== eventPr.base.sha ||
    merged.parents.length !== 2 ||
    merged.parents[0].sha !== eventPr.base.sha ||
    merged.parents[1].sha !== pr.head.sha
  )
    throw new Error("Promotion must merge the reviewed base and source");
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

export async function recordDeployment({ context }) {
  if (process.env.DEPLOY_EXIT_CODE !== "0")
    throw new Error("Only successful deployments produce reuse evidence");
  const directory = process.env.CANDIDATE_DIR;
  const candidate = JSON.parse(await readFile(directory + "/candidate.json", "utf8"));
  assertCandidate(candidate, candidate);
  const pr = context.payload.pull_request;
  const receipt = {
    releaseId: releaseId(candidate),
    exitCode: 0,
    runId: Number(process.env.GITHUB_RUN_ID),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    candidateArtifactId: Number(process.env.CANDIDATE_ARTIFACT_ID),
    commandId: process.env.OCI_COMMAND_ID,
    mergedSha: pr.merge_commit_sha,
  };
  if (
    candidate.prNumber !== pr.number ||
    candidate.sourceSha !== pr.head.sha ||
    !sha.test(receipt.mergedSha) ||
    !/^ocid1\.instanceagentcommand\.[a-z0-9.-]+$/.test(receipt.commandId) ||
    ![receipt.runId, receipt.runAttempt, receipt.candidateArtifactId].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    )
  )
    throw new Error("Invalid deployment receipt identity");
  await writeFile(directory + "/receipt.json", JSON.stringify(receipt) + "\n");
}
