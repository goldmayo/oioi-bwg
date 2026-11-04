import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

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

const rawChange = (path: string, before = "100644", after = "100644", status = "M") =>
  `:${before} ${after} ${"a".repeat(40)} ${"b".repeat(40)} ${status}\0${path}\0`;

const workflow = readFileSync(
  new URL("../../.github/workflows/verify.yml", import.meta.url),
  "utf8",
);

function imageCommands(
  raw: string,
  tasks: { package: string }[] = [],
  ignore = "docs\n",
  sourceWorkflow = workflow,
) {
  return vi.fn((cmd: string, args: string[]) => {
    if (cmd !== "git") return JSON.stringify({ tasks });
    if (args[0] === "show") {
      if (args[1].endsWith(":.dockerignore")) return ignore;
      return args[1].startsWith(candidate.sourceSha) ? workflow : sourceWorkflow;
    }
    if (args[0] === "diff") return raw;
    return "";
  });
}

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
    head_branch: "main",
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
      ref: "main",
      repo: { full_name: "goldmayo/oioi-bwg" },
    },
    base: { ref: "production", sha: "f".repeat(40) },
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
  const merged = {
    tree: { sha: candidate.sourceTree },
    parents: [{}] as { sha?: string }[],
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
        getCommit: vi.fn(async ({ commit_sha }: { commit_sha: string }) => ({
          data:
            commit_sha === receipt.mergedSha
              ? merged
              : { tree: { sha: candidate.sourceTree }, parents: [] },
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
    merged,
    receipt: structuredClone(receipt),
    candidate: structuredClone(candidate),
    proof,
    repositories: candidate.images,
  };
}

describe("paired release evidence and conservative image selection", () => {
  test.each([
    ".github/workflows/verify.yml",
    ".github/workflows/publish-build-cache.yml",
    ".github/workflows/deploy-promotion.yml",
  ])("동일 빌드 job을 유지한 %s 변경은 검증된 두 이미지를 재사용한다", (file) => {
    const execute = imageCommands(
      rawChange(file),
      [],
      "docs\n.github\n",
      workflow.replace("timeout-minutes: 2", "timeout-minutes: 3"),
    );
    expect(
      planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), execute }).build,
    ).toEqual({ web: false, console: false });
    expect(execute.mock.calls.some(([cmd]) => cmd === "turbo")).toBe(false);
  });
  test.each([
    ["NEXT_PUBLIC_APP_ENV: production", "NEXT_PUBLIC_APP_ENV: preview"],
    ['SENTRY_SOURCE_MAPS_ENABLED: "true"', 'SENTRY_SOURCE_MAPS_ENABLED: "false"'],
    ["platforms: linux/arm64", "platforms: linux/amd64"],
    ["file: apps/${{ matrix.app }}/Dockerfile", "file: alternate/Dockerfile"],
    ["docker/build-push-action@v6", "docker/build-push-action@v7"],
    ["target: runner", "target: builder"],
    ["name: Verify", "name: Verify\nenv:\n  NODE_OPTIONS: --jitless"],
    ["name: Verify", "name: Verify\ndefaults:\n  run:\n    working-directory: apps/web"],
  ])("CI 변경이어도 빌드 입력 %s 변경은 두 이미지를 다시 빌드한다", (before, after) => {
    expect(workflow).toContain(before);
    const execute = imageCommands(
      rawChange(".github/workflows/verify.yml"),
      [],
      "docs\n.github\n",
      workflow.replaceAll(before, after),
    );
    expect(
      planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), execute }).build,
    ).toEqual({ web: true, console: true });
  });
  test.each([
    [rawChange(".github/workflows/unknown.yml"), "docs\n.github\n", workflow],
    [rawChange(".github/actions/build/action.yml"), "docs\n.github\n", workflow],
    [rawChange(".github/workflows/verify.yml", "100755"), "docs\n.github\n", workflow],
    [rawChange(".github/workflows/verify.yml", "100644", "120000"), "docs\n.github\n", workflow],
    [rawChange(".github/workflows/verify.yml"), "docs\n", workflow],
    [rawChange(".github/workflows/verify.yml"), ".github\n!.github/actions", workflow],
    [rawChange(".github/workflows/verify.yml"), ".github\n", "jobs: ["],
    [rawChange(".github/workflows/verify.yml"), ".github\n", "jobs: {}"],
    [rawChange(".github/workflows/verify.yml"), ".github\n", workflow + "\njobs: {}\n"],
  ])("CI 제외 근거가 불완전하거나 미분류 변경이면 재빌드한다", (raw, ignore, source) => {
    const execute = imageCommands(raw, [], ignore, source);
    expect(
      planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), execute }).build,
    ).toEqual({ web: true, console: true });
  });
  test("CI·앱 혼합 변경과 앱→CI rename은 앱 변경을 누락하지 않는다", () => {
    for (const raw of [
      rawChange("apps/console/a.tsx") + rawChange(".github/workflows/verify.yml"),
      rawChange("apps/console/a.tsx", "100644", "000000", "D") +
        rawChange(".github/workflows/deploy-promotion.yml", "000000", "100644", "A"),
    ]) {
      const execute = imageCommands(raw, [{ package: "@oioi-bwg/console" }], ".github\n");
      expect(
        planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), execute }).build,
      ).toEqual({ web: false, console: true });
    }
  });
  test("실제 Git 두 커밋의 CI-only 변경은 pnpm 없이 재사용을 판정한다", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-ci-inputs-"));
    const tools = await mkdtemp(join(tmpdir(), "image-plan-tools-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
    try {
      git("init", "-q");
      git("config", "user.name", "fixture");
      git("config", "user.email", "fixture@example.test");
      await mkdir(join(directory, "ops/oci"), { recursive: true });
      for (const file of ["release-baseline.mjs", "promotion.mjs"])
        await copyFile(
          new URL(`../../ops/oci/${file}`, import.meta.url),
          join(directory, "ops/oci", file),
        );
      await mkdir(join(tools, "node_modules"));
      await writeFile(join(tools, "package.json"), "{}");
      await symlink(
        dirname(fileURLToPath(import.meta.resolve("yaml/package.json"))),
        join(tools, "node_modules/yaml"),
        "dir",
      );
      await writeFile(join(directory, ".dockerignore"), ".github\n");
      await mkdir(join(directory, ".github/workflows"), { recursive: true });
      const path = join(directory, ".github/workflows/verify.yml");
      await writeFile(path, workflow);
      git("add", ".");
      git("commit", "-qm", "baseline");
      const sourceSha = git("rev-parse", "HEAD");
      const baseline = {
        ...candidate,
        sourceSha,
        images: Object.fromEntries(
          Object.entries(candidate.images).map(([app, image]) => [
            app,
            { ...image, buildSourceSha: sourceSha },
          ]),
        ),
      };
      const verified = { ...proof, releaseId: releaseId(baseline) };
      await writeFile(path, workflow.replace("timeout-minutes: 2", "timeout-minutes: 3"));
      git("commit", "-qam", "verification timeout");
      const execute = vi.fn((command: string, args: string[]) => {
        if (command !== "git") throw new Error("CI-only selection must not need pnpm");
        return execFileSync(command, args, { cwd: directory, encoding: "utf8" });
      });
      expect(
        planImages({ baseline, proof: verified, sourceSha: git("rev-parse", "HEAD"), execute })
          .build,
      ).toEqual({ web: false, console: false });
      const isolated = execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `
        const { planImages } = await import('./ops/oci/release-baseline.mjs');
        console.log(JSON.stringify(planImages(JSON.parse(process.argv[1])).build));
      `,
          JSON.stringify({ baseline, proof: verified, sourceSha: git("rev-parse", "HEAD") }),
        ],
        {
          cwd: directory,
          encoding: "utf8",
          env: { ...process.env, PROMOTION_TOOLS_MANIFEST: join(tools, "package.json") },
        },
      );
      expect(existsSync(join(directory, "node_modules"))).toBe(false);
      expect(JSON.parse(isolated)).toEqual({ web: false, console: false });
    } finally {
      await Promise.all(
        [directory, tools].map((path) => rm(path, { recursive: true, force: true })),
      );
    }
  });
  test("제품 의존성 설치 없이 같은 Turbo workspace 그래프를 계산한다", async () => {
    const directory = await mkdtemp(join(tmpdir(), "image-plan-graph-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, {
        cwd: directory,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    try {
      execFileSync("git", ["clone", "--shared", "--quiet", process.cwd(), directory]);
      git("config", "user.name", "fixture");
      git("config", "user.email", "fixture@example.test");
      const base = git("rev-parse", "HEAD");
      const file = join(directory, "apps/console/src/shared/ui/button.tsx");
      await writeFile(file, (await readFile(file, "utf8")) + "\n// graph fixture\n");
      git("commit", "-qam", "fixture");
      const head = git("rev-parse", "HEAD");
      const tasks = () =>
        JSON.parse(
          execFileSync("turbo", ["run", "build", "--affected", "--dry=json"], {
            cwd: directory,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, TURBO_SCM_BASE: base, TURBO_SCM_HEAD: head },
          }),
        ).tasks.map((task: { taskId: string }) => task.taskId);
      expect(existsSync(join(directory, "node_modules"))).toBe(false);
      const isolated = tasks();
      expect(isolated).toContain("@oioi-bwg/console#build");
      expect(isolated).not.toContain("@oioi-bwg/web#build");
      // Turbo can create its configured node_modules/.cache without installing packages.
      await rm(join(directory, "node_modules"), { recursive: true, force: true });
      await symlink(join(process.cwd(), "node_modules"), join(directory, "node_modules"), "dir");
      expect(tasks()).toEqual(isolated);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test("계획 도구 준비는 고정된 두 패키지만 생성하고 범위 버전을 거절한다", async () => {
    const root = await mkdtemp(join(tmpdir(), "image-plan-bootstrap-"));
    const steps = parse(workflow).jobs.promotion_plan.steps;
    const script = steps.find(
      (step: { name?: string }) => step.name === "Prepare isolated image planning tools",
    ).run;
    try {
      await mkdir(join(root, "bin"));
      await writeFile(join(root, "bin/npm"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
      const manifest = JSON.parse(
        readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
      );
      await writeFile(join(root, "package.json"), JSON.stringify(manifest));
      const env = {
        ...process.env,
        PATH: join(root, "bin") + ":" + process.env.PATH,
        PROMOTION_TOOLS_DIR: join(root, "tools"),
        GITHUB_PATH: join(root, "path"),
      };
      execFileSync("bash", ["-e", "-o", "pipefail", "-c", script], { cwd: root, env });
      expect(JSON.parse(await readFile(join(root, "tools/package.json"), "utf8"))).toEqual({
        private: true,
        dependencies: {
          yaml: manifest.devDependencies.yaml,
          turbo: manifest.devDependencies.turbo,
        },
      });
      manifest.devDependencies.yaml = "^2.8.2";
      await writeFile(join(root, "package.json"), JSON.stringify(manifest));
      expect(() =>
        execFileSync("bash", ["-e", "-c", script], { cwd: root, env, stdio: "pipe" }),
      ).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  test.each(["web", "console"])("reuses only the unchanged app when %s changes", (app) => {
    const execute = vi.fn((cmd: string) =>
      cmd === "git"
        ? rawChange(`apps/${app}/src/page.tsx`)
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
    "apps/web/Dockerfile",
    "apps/console/Dockerfile",
    "ops/docker/Dockerfile.dev",
    "turbo.json",
    "config/build.ts",
    "unknown/file",
  ])("rebuilds both for %s", (path) => {
    const execute = vi.fn(() => rawChange(path));
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
      { execute: (cmd: string) => (cmd === "git" ? rawChange("apps/web/a") : "invalid JSON") },
    ])
      expect(
        planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), ...input }).build,
      ).toEqual({ web: true, console: true });
  });
  test("문서·시안이 섞인 Console 변경은 UI transit 때문에 Web을 재빌드하지 않는다", () => {
    const execute = imageCommands(
      rawChange("apps/console/src/page.tsx") + rawChange("docs/mockup.png"),
      [{ package: "@oioi-bwg/console" }, { package: "@oioi-bwg/ui" }],
    );
    expect(
      planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), execute }).build,
    ).toEqual({ web: false, console: true });
  });
  test.each(["docs", "!docs/a.md\ndocs", "docs\n!docs/a.md"])(
    "문서 제외는 현재 Docker ignore 계약 %s에 종속된다",
    (ignore) => {
      const execute = imageCommands(rawChange("docs/a.md"), [], ignore);
      const reused = ignore === "docs";
      expect(
        planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), execute }).build,
      ).toEqual({ web: !reused, console: !reused });
    },
  );
  test.each([
    rawChange("docs/a.md", "100755"),
    rawChange("docs/a.md", "100644", "120000"),
    rawChange("docs/a.md") + rawChange("packages/ui/src/data-table.tsx"),
    rawChange("docs/a.md") + "malformed\0",
    rawChange("docs/a.md").slice(0, -1),
  ])("mode·공용 소스·불완전 diff는 보수적으로 두 이미지를 빌드한다", (raw) => {
    const execute = imageCommands(raw);
    expect(
      planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), execute }).build,
    ).toEqual({ web: true, console: true });
  });
  test("rename 양쪽의 앱 경로를 보존한다", () => {
    const execute = imageCommands(
      rawChange("apps/web/a.ts", "100644", "000000", "D") +
        rawChange("docs/a.md", "000000", "100644", "A"),
    );
    expect(
      planImages({ baseline: candidate, proof, sourceSha: "f".repeat(40), execute }).build,
    ).toEqual({ web: true, console: false });
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
  test("keeps successful legacy squash receipts as reuse evidence", async () => {
    const f = fixture();
    expect(f.merged.parents).toEqual([{}]);
    await expect(validateBaseline(f)).resolves.toEqual(proof);
  });
  test("accepts a deployed merge with the exact reviewed base and source parents", async () => {
    const f = fixture();
    f.merged.parents = [{ sha: f.pr.base.sha }, { sha: candidate.sourceSha }];
    await expect(validateBaseline(f)).resolves.toEqual(proof);
  });
  test.each(["base", "source", "reversed", "extra", "missing", "invalid-base", "tree"])(
    "rejects a deployed merge with mismatched %s",
    async (failure) => {
      const f = fixture();
      f.merged.parents = [{ sha: f.pr.base.sha }, { sha: candidate.sourceSha }];
      if (failure === "base") f.merged.parents[0].sha = "0".repeat(40);
      if (failure === "source") f.merged.parents[1].sha = "0".repeat(40);
      if (failure === "reversed") f.merged.parents.reverse();
      if (failure === "extra") f.merged.parents.push({ sha: "0".repeat(40) });
      if (failure === "missing") f.merged.parents = [];
      if (failure === "invalid-base") {
        f.pr.base.sha = "invalid";
        f.merged.parents[0].sha = "invalid";
      }
      if (failure === "tree") f.merged.tree.sha = "0".repeat(40);
      await expect(validateBaseline(f)).rejects.toThrow("Deployment tree mismatch");
    },
  );
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

test("old migration branch names remain readable in immutable deployment evidence", async () => {
  const f = fixture();
  f.run.head_branch = "migration_main";
  f.verification.head_branch = "migration_main";
  f.pr.head.ref = "migration_main";
  f.pr.base.ref = "migration_develop";
  await expect(validateBaseline(f)).resolves.toEqual(proof);
});
