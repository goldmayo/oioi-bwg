import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vitest";

import { buildConfigHash, releaseId, assertCandidate } from "../../ops/oci/promotion.mjs";
import {
  findBaseline,
  planImages,
  validateBaseline,
  selectImages,
} from "../../ops/oci/release-baseline.mjs";

const candidate = {
  prNumber: 142,
  sourceSha: "a".repeat(40),
  sourceTree: "b".repeat(40),
  runId: 17,
  runAttempt: 1,
  baseline: null,
  buildConfigHash: buildConfigHash(),
  images: Object.fromEntries(
    ["web", "console"].map((app) => [
      app,
      {
        repository: `registry.test/namespace/${app}`,
        digest: `sha256:${(app === "web" ? "c" : "d").repeat(64)}`,
        buildSourceSha: "a".repeat(40),
        origin: "built",
      },
    ]),
  ),
};
const proof = { releaseId: releaseId(candidate), artifactId: 99, runId: 31, runAttempt: 2 };
const receipt = {
  ...proof,
  exitCode: 0,
  commandId: "ocid1.instanceagentcommand.test.abc",
  mergedSha: "e".repeat(40),
  candidateArtifactId: 88,
};

function fixture() {
  const artifacts = [
    { id: 99, name: "paired-deployment-31-2", expired: false, expires_at: "2999-01-01" },
  ];
  const verifiedArtifacts = [
    {
      id: 88,
      name: `promotion-${candidate.sourceSha}-1`,
      expired: false,
      expires_at: "2999-01-01",
      created_at: "2026-10-01",
    },
  ];
  const run = {
    id: 31,
    run_attempt: 2,
    path: ".github/workflows/deploy-promotion.yml",
    event: "pull_request",
    head_sha: candidate.sourceSha,
    head_branch: "migration_main",
    head_repository: { full_name: "goldmayo/oioi-bwg" },
    status: "completed",
    conclusion: "success",
    pull_requests: [{ number: 142 }],
    updated_at: "2026-10-02",
  };
  const pr = {
    merged: true,
    merged_at: "2026-10-02",
    number: 142,
    merge_commit_sha: receipt.mergedSha,
    head: {
      sha: candidate.sourceSha,
      ref: "migration_main",
      repo: { full_name: "goldmayo/oioi-bwg" },
    },
    base: { ref: "migration_develop" },
  };
  const checks = ["verify", "promotion", "promotion candidate"].map((name) => ({
    name,
    conclusion: "success",
    completed_at: "2026-10-01",
  }));
  const verification = {
    ...run,
    id: 17,
    run_attempt: 1,
    path: ".github/workflows/verify.yml",
    head_sha: candidate.sourceSha,
  };
  const github = {
    rest: {
      actions: {
        listWorkflowRuns: vi.fn(),
        listWorkflowRunArtifacts: vi.fn(),
        listJobsForWorkflowRunAttempt: vi.fn(),
        getWorkflowRun: vi.fn(async ({ run_id }: { run_id: number }) => ({
          data: run_id === 31 ? run : verification,
        })),
      },
      pulls: { get: vi.fn(async () => ({ data: pr })) },
      git: {
        getCommit: vi.fn(async () => ({
          data: { tree: { sha: candidate.sourceTree }, parents: [{}] },
        })),
      },
    },
    paginate: vi.fn(async (method: unknown, args: { run_id: number }) =>
      method === github.rest.actions.listWorkflowRuns
        ? [run]
        : method === github.rest.actions.listWorkflowRunArtifacts
          ? args.run_id === 31
            ? artifacts
            : verifiedArtifacts
          : args.run_id === 31
            ? [{ name: "deploy", conclusion: "success" }]
            : checks,
    ),
  };
  return {
    github,
    context: { repo: { owner: "goldmayo", repo: "oioi-bwg" } },
    core: { setOutput: vi.fn(), info: vi.fn() },
    run,
    pr,
    artifacts,
    verifiedArtifacts,
    checks,
    verification,
    receipt: structuredClone(receipt),
    candidate: structuredClone(candidate),
    proof,
    repositories: candidate.images,
  };
}

describe("paired release evidence and conservative image selection", () => {
  test.each(["web", "console"])("reuses only the unchanged app when %s changes", (app) => {
    const execute = vi.fn((cmd: string) =>
      cmd === "git"
        ? `apps/${app}/src/page.tsx\0`
        : JSON.stringify({
            tasks: [
              { package: `@oioi-bwg/${app}` },
              { package: "@oioi-bwg/server", command: "<NONEXISTENT>" },
            ],
          }),
    );
    expect(
      planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), execute }).build,
    ).toEqual({ web: app === "web", console: app === "console" });
    expect(execute.mock.calls[0]).toEqual([
      "git",
      ["merge-base", "--is-ancestor", candidate.sourceSha, "f".repeat(40)],
      { stdio: ["ignore", "pipe", "pipe"] },
    ]);
  });
  test.each([
    "packages/server/db.ts",
    "pnpm-lock.yaml",
    "Dockerfile",
    "turbo.json",
    "config/build.ts",
    "unknown/file",
  ])("rebuilds both for %s", (path) => {
    const execute = vi.fn(() => path + "\0");
    expect(
      planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), execute }).build,
    ).toEqual({ web: true, console: true });
  });
  test("rebuilds both for missing baseline, config change, missing history or failed Turbo", () => {
    for (const input of [
      { baseline: null },
      { configHash: "0".repeat(64) },
      { proof: { ...proof, releaseId: "0".repeat(64) } },
      {
        execute: () => {
          throw new Error("git unavailable");
        },
      },
      { execute: (cmd: string) => (cmd === "git" ? "apps/web/a\0" : "invalid JSON") },
    ])
      expect(
        planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), ...input }).build,
      ).toEqual({ web: true, console: true });
  });
  test("keeps build provenance separate and binds canonical pair identity", () => {
    const next = {
      ...candidate,
      sourceSha: "f".repeat(40),
      baseline: proof,
      images: {
        ...candidate.images,
        console: { ...candidate.images.console, origin: "reused" },
        web: { ...candidate.images.web, buildSourceSha: "f".repeat(40) },
      },
    };
    expect(() => assertCandidate(next, next)).not.toThrow();
    expect(() => assertCandidate({ ...next, baseline: null }, next)).toThrow();
    expect(() =>
      assertCandidate(
        { ...candidate, sourceSha: "f".repeat(40) },
        { ...candidate, sourceSha: "f".repeat(40) },
      ),
    ).toThrow();
    expect(releaseId(next)).not.toBe(proof.releaseId);
    expect(
      releaseId({
        ...candidate,
        images: { console: candidate.images.console, web: candidate.images.web },
      }),
    ).toBe(proof.releaseId);
  });
  test("finds only the latest successful deployment and checks its entire provenance", async () => {
    const f = fixture();
    await findBaseline(f);
    expect(f.core.setOutput).toHaveBeenCalledWith("artifact_id", 99);
    await expect(validateBaseline(f)).resolves.toEqual(proof);
  });
  test.each([{ associations: [] }, { associations: [{ number: 159 }] }])(
    "keeps the immutable deployment PR when GitHub changes run associations to $associations",
    async ({ associations }) => {
      const f = fixture();
      f.run.pull_requests = associations;
      await expect(validateBaseline(f)).resolves.toEqual(proof);
      expect(f.github.rest.pulls.get).toHaveBeenCalledWith({
        ...f.context.repo,
        pull_number: candidate.prNumber,
      });
    },
  );
  test.each([
    "expired",
    "missing",
    "attempt",
    "foreign",
    "failure",
    "receipt",
    "digest",
    "pr",
    "deployment-source",
    "tree",
    "verification",
    "verification-artifact",
    "late-check",
  ])("rejects %s deployment evidence", async (failure) => {
    const f = fixture();
    if (failure === "expired") f.artifacts[0].expired = true;
    if (failure === "missing") f.artifacts.splice(0);
    if (failure === "attempt") f.run.run_attempt++;
    if (failure === "foreign") f.run.head_repository.full_name = "attacker/repo";
    if (failure === "failure") f.run.conclusion = "failure";
    if (failure === "receipt") f.receipt.exitCode = 20;
    if (failure === "digest") f.candidate.images.web.digest = `sha256:${"0".repeat(64)}`;
    if (failure === "pr") f.pr.head.sha = "0".repeat(40);
    if (failure === "deployment-source") f.run.head_sha = "0".repeat(40);
    if (failure === "tree") f.candidate.sourceTree = "0".repeat(40);
    if (failure === "verification") f.verification.run_attempt++;
    if (failure === "verification-artifact") f.verifiedArtifacts[0].expired = true;
    if (failure === "late-check") f.checks[0].completed_at = "2999-01-01";
    await expect(validateBaseline(f)).rejects.toThrow();
  });
  test("materializes a build plan from verified evidence and discards invalid evidence", async () => {
    const f = fixture();
    const root = await mkdtemp(join(tmpdir(), "release-selection-"));
    try {
      for (const [key, value] of Object.entries({
        BASELINE_DIR: root,
        IMAGE_PLAN_FILE: root + "/plan.json",
        BASELINE_ARTIFACT_ID: "99",
        BASELINE_RUN_ID: "31",
        BASELINE_RUN_ATTEMPT: "2",
        IMAGE_REPOSITORY: candidate.images.web.repository,
        CONSOLE_IMAGE_REPOSITORY: candidate.images.console.repository,
      }))
        vi.stubEnv(key, value);
      await writeFile(root + "/candidate.json", JSON.stringify(candidate));
      await writeFile(root + "/receipt.json", JSON.stringify(receipt));
      const context = {
        ...f.context,
        payload: { pull_request: { head: { sha: "f".repeat(40) } } },
      };
      await selectImages({ ...f, context });
      expect(JSON.parse(await readFile(root + "/plan.json", "utf8"))).toMatchObject({
        baseline: proof,
        build: { web: true, console: true },
      });
      await writeFile(root + "/receipt.json", JSON.stringify({ ...receipt, exitCode: 20 }));
      await selectImages({ ...f, context });
      expect(JSON.parse(await readFile(root + "/plan.json", "utf8"))).toMatchObject({
        baseline: null,
        build: { web: true, console: true },
      });
    } finally {
      vi.unstubAllEnvs();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("does not fall back to an older artifact or expose API error text", async () => {
    const f = fixture();
    f.artifacts[0].expired = true;
    await findBaseline(f);
    expect(f.core.setOutput).not.toHaveBeenCalled();
    f.github.paginate.mockRejectedValueOnce(new Error("secret-provider-response"));
    await findBaseline(f);
    expect(f.core.info).toHaveBeenCalledWith(
      "Deployment evidence unavailable; rebuild both images",
    );
  });
});
