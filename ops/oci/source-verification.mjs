import { docsOnly, verificationJobNames } from "../../scripts/verification-scope.mjs";
import { prepare } from "./promotion.mjs";

const fullJobs = Object.values(verificationJobNames);

// Reuse successful code checks, never a build cache or a deployment candidate.
async function mainVerification({ github, context, head, tree }, depth = 0) {
  if (depth > 4) throw new Error("Verification history exceeds the allowed depth");
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
  if (!full && !docs) {
    if (
      !fullJobs.every((name) => result(name) === "skipped") ||
      result("reuse main verification") !== "success" ||
      result("changed files and affected workspaces") !== "skipped"
    )
      throw new Error("Source lacks complete code checks or proven history-only scope");
    const base = await historyParents({ github, context, pr, tree, mergedSha: head });
    const evidence = await mainVerification({ github, context, head: base, tree }, depth + 1);
    return { ...evidence, sourceSha: head };
  }
  return { sourceSha: head, sourceTree: tree, runId: run.id };
}

async function historyParents({ github, context, pr, tree, mergedSha }) {
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  if (pr.base.ref !== "migration_main" || pr.head.repo?.full_name !== repository)
    throw new Error("Only same-repository main history is reusable");
  const { data: head } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: pr.head.sha,
  });
  if (head.parents.length !== 2 || head.tree.sha !== tree) throw new Error("Invalid history merge");
  const [baseSha, developSha] = head.parents.map((parent) => parent.sha);
  if (![baseSha, developSha].every((value) => /^[0-9a-f]{40}$/.test(value)))
    throw new Error("Invalid history parents");
  const { data: base } = await github.rest.git.getCommit({ ...context.repo, commit_sha: baseSha });
  if (base.tree.sha !== tree) throw new Error("History changes source files");
  if (mergedSha) {
    const { data: merged } = await github.rest.git.getCommit({
      ...context.repo,
      commit_sha: mergedSha,
    });
    if (
      merged.tree.sha !== tree ||
      merged.parents.length !== 2 ||
      merged.parents[0].sha !== baseSha ||
      merged.parents[1].sha !== pr.head.sha
    )
      throw new Error("History merge did not preserve its reviewed parents");
  } else {
    const branches = await Promise.all(
      ["migration_main", "migration_develop"].map((branch) =>
        github.rest.repos.getBranch({ ...context.repo, branch }),
      ),
    );
    if (branches[0].data.commit.sha !== baseSha || branches[1].data.commit.sha !== developSha)
      throw new Error("History parents are not the current branch heads");
  }
  const prs = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
    ...context.repo,
    commit_sha: developSha,
    per_page: 100,
  });
  const promotion = prs.find(
    (item) =>
      item.merged_at &&
      item.merge_commit_sha === developSha &&
      item.base.ref === "migration_develop" &&
      item.head.ref === "migration_main" &&
      item.head.repo?.full_name === repository,
  );
  if (!promotion) throw new Error("History parent has no normal Promotion");
  const commits = await Promise.all(
    [developSha, promotion.head.sha].map((commit_sha) =>
      github.rest.git.getCommit({ ...context.repo, commit_sha }),
    ),
  );
  if (commits[0].data.tree.sha !== commits[1].data.tree.sha)
    throw new Error("Deployment parent changed its source files");
  const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
    ...context.repo,
    basehead: `${promotion.head.sha}...${baseSha}`,
  });
  if (!["ahead", "identical"].includes(comparison.status))
    throw new Error("History would discard deployment changes");
  return baseSha;
}

function publish(core, proof) {
  core.info(
    `Reuse verified source ${proof.sourceSha}, tree ${proof.sourceTree}, Verify ${proof.runId}`,
  );
  core.setOutput("verification_run_id", proof.runId);
  return proof;
}

export async function verifySource({ github, context, core }) {
  const tree = await prepare({ github, context, core });
  const head = context.payload.pull_request.head.sha;
  return publish(core, await mainVerification({ github, context, head, tree }));
}

export async function verifyHistory({ github, context, core }) {
  const { data: pr } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: context.payload.pull_request.number,
  });
  if (pr.state !== "open" || pr.draft || pr.head.sha !== context.payload.pull_request.head.sha)
    throw new Error("History PR changed or is not Ready");
  const { data: merge } = await github.rest.git.getCommit({
    ...context.repo,
    commit_sha: context.sha,
  });
  const base = await historyParents({ github, context, pr, tree: merge.tree.sha });
  const evidence = await mainVerification({ github, context, head: base, tree: merge.tree.sha });
  return publish(core, { ...evidence, sourceSha: pr.head.sha });
}
