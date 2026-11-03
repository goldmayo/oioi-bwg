import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findMergedCache } from "../../scripts/verification-cache.mjs";

it("native 캐시의 저장·조회·복원은 같은 경로 버전을 사용한다", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/verify.yml", import.meta.url),
    "utf8",
  );
  const publisher = readFileSync(
    new URL("../../.github/workflows/publish-build-cache.yml", import.meta.url),
    "utf8",
  );
  const native = workflow.split("\n  waveform:\n")[1].split("\n  postgres_integration:")[0];
  const restorePath = native.match(/path: (.+)\n\s+key:/)?.[1];
  expect(restorePath).toBeTruthy();
  expect(publisher.match(/path: (.+)\n\s+key:/g)).toHaveLength(2);
  for (const path of publisher.matchAll(/path: (.+)\n\s+key:/g)) expect(path[1]).toBe(restorePath);
  expect(native).not.toContain("waveform-cache");
});

it("Promotion cache는 앱별 registry를 공유하며 후보 검증과 lockfile 설치를 유지한다", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/verify.yml", import.meta.url),
    "utf8",
  );
  const candidate = workflow.split("\n  promotion-candidate:\n")[1].split("\n  promotion:\n")[0];
  const images = workflow
    .split("\n  promotion_images:\n")[1]
    .split("\n  promotion-candidate:\n")[0];
  const ref = "type=registry,ref=${{ matrix.repository }}:buildcache-arm64-v1";
  expect(images).toContain(`cache-from: ${ref}`);
  expect(images).toContain(
    `cache-to: ${ref},mode=max,image-manifest=true,oci-mediatypes=true,ignore-error=true`,
  );
  expect(images).toContain("file: apps/${{ matrix.app }}/Dockerfile");
  expect(images).toContain("max-parallel: 2");
  expect(images).not.toContain("type=gha");
  expect(candidate).not.toContain("cache: pnpm");
  expect(candidate).toContain("pnpm install --frozen-lockfile");
  expect(candidate).toContain("playwright install --with-deps --only-shell chromium");
  expect(candidate).toContain("bash ops/oci/smoke-paired-candidate.sh");
  expect(candidate).toContain("await promotion.record({ github, context, core })");
});

function fixture() {
  const key = "Linux-verify-amd64-v4-input";
  const context = {
    eventName: "push",
    ref: "refs/heads/migration_main",
    sha: "merged",
    repo: { owner: "owner", repo: "repo" },
  };
  const pr = {
    number: 42,
    merged_at: "2026-10-21T06:00:00Z",
    merge_commit_sha: "merged",
    base: { ref: "migration_main" },
    head: { sha: "source", repo: { full_name: "owner/repo" } },
  };
  const run = {
    id: 100,
    event: "pull_request",
    path: ".github/workflows/verify.yml",
    head_sha: "source",
    head_commit: { tree_id: "tree" },
    head_repository: { full_name: "owner/repo" },
    status: "completed",
    conclusion: "success",
    updated_at: "2026-10-21T05:59:00Z",
  };
  const artifact = {
    id: 200,
    name: `ci-build-cache-${key}`,
    expired: false,
    created_at: "2026-10-21T05:58:00Z",
    expires_at: "2099-01-01T00:00:00Z",
  };
  const jobs = ["app build", "verify"].map((name) => ({ name, conclusion: "success" }));
  const github = {
    rest: {
      repos: { listPullRequestsAssociatedWithCommit: vi.fn().mockResolvedValue([pr]) },
      actions: {
        listWorkflowRuns: vi.fn().mockResolvedValue({ data: { workflow_runs: [run] } }),
        listJobsForWorkflowRun: vi.fn().mockResolvedValue(jobs),
        listWorkflowRunArtifacts: vi.fn().mockResolvedValue([artifact]),
      },
    },
    paginate: vi.fn((method, args) => method(args)),
  };
  const core = { info: vi.fn(), setOutput: vi.fn() };
  return { context, pr, run, artifact, jobs, github, core, key, tree: "tree" };
}

describe("merged PR cache publication", () => {
  it("publishes the successful merged tree using the original content key", async () => {
    const f = fixture();
    await findMergedCache(f);
    expect(f.core.setOutput.mock.calls).toEqual([
      ["artifact_id", 200],
      ["run_id", 100],
      ["key", f.key],
    ]);
    expect(f.github.rest.actions.listWorkflowRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_id: "verify.yml",
        head_sha: "source",
        event: "pull_request",
        status: "success",
      }),
    );
  });

  it("also publishes Promotion cache under migration_develop", async () => {
    const f = fixture();
    f.context.ref = "refs/heads/migration_develop";
    f.pr.base.ref = "migration_develop";
    await findMergedCache(f);
    expect(f.core.setOutput).toHaveBeenCalledWith("artifact_id", 200);
  });

  it("파형 cache는 app build 대신 성공한 ARM64 job을 요구한다", async () => {
    const f = fixture();
    await findMergedCache({ ...f, kind: "waveform" });
    expect(f.core.setOutput).not.toHaveBeenCalled();
    f.jobs[0].name = "waveform ARM64";
    await findMergedCache({ ...f, kind: "waveform" });
    expect(f.core.setOutput).toHaveBeenCalledWith("artifact_id", 200);
  });

  it.each(["failure", "skipped", "cancelled"])(
    "파형 job이 %s면 cache를 게시하지 않는다",
    async (conclusion) => {
      const f = fixture();
      f.jobs[0] = { name: "waveform ARM64", conclusion };
      await findMergedCache({ ...f, kind: "waveform" });
      expect(f.core.setOutput).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["context.eventName", "pull_request"],
    ["context.ref", "refs/heads/feature/test"],
    ["pr.merged_at", ""],
    ["pr.merge_commit_sha", "other"],
    ["pr.base.ref", "main"],
    ["pr.head.repo.full_name", "fork/repo"],
    ["run.head_sha", "old"],
    ["run.head_commit.tree_id", "old"],
    ["run.head_repository.full_name", "fork/repo"],
    ["run.path", ".github/workflows/other.yml"],
    ["run.event", "workflow_dispatch"],
    ["run.conclusion", "failure"],
    ["run.status", "in_progress"],
    ["run.updated_at", "2026-10-21T06:01:00Z"],
    ["run.updated_at", ""],
    ["jobs.1.conclusion", "failure"],
    ["jobs.0.conclusion", "skipped"],
    ["artifact.name", "different-input"],
    ["artifact.expired", true],
    ["artifact.expires_at", "2020-01-01T00:00:00Z"],
    ["artifact.expires_at", ""],
    ["artifact.created_at", "2026-10-21T06:01:00Z"],
  ])("rejects changed %s = %s", async (path, value) => {
    const f = fixture();
    const parts = String(path).split(".");
    let target = f as unknown as Record<string, unknown>;
    for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>;
    target[parts.at(-1)!] = value;
    await findMergedCache(f);
    expect(f.core.setOutput).not.toHaveBeenCalled();
  });

  it.each([{ artifacts: [] }, { artifacts: [fixture().artifact, fixture().artifact] }])(
    "ignores missing or ambiguous artifacts %j",
    async ({ artifacts }) => {
      const f = fixture();
      f.github.rest.actions.listWorkflowRunArtifacts.mockResolvedValue(artifacts);
      await findMergedCache(f);
      expect(f.core.setOutput).not.toHaveBeenCalled();
    },
  );
});

it("실제 Git에서 앱 변경은 파형 key를 보존하고 Rust·Go 입력 변경은 무효화한다", () => {
  const root = mkdtempSync(join(tmpdir(), "native-cache-key-"));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
  const write = (file: string, content: string) => {
    const path = join(root, file);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
    git("add", "--", file);
  };
  const key = (kind: string) =>
    execFileSync(
      process.execPath,
      [new URL("../../scripts/verification-cache.mjs", import.meta.url).pathname, kind],
      { cwd: root, env, encoding: "utf8" },
    ).trim();
  try {
    git("init", "-q");
    write("ops/waveform/Cargo.lock", "rust-1");
    write("ops/waveform-runner/go.sum", "go-1");
    const first = key("waveform");
    write("apps/console/src/page.tsx", "changed UI");
    expect(key("waveform")).toBe(first);
    write("ops/waveform/Cargo.lock", "rust-2");
    const rust = key("waveform");
    expect(rust).not.toBe(first);
    write("ops/waveform-runner/go.sum", "go-2");
    expect(key("waveform")).not.toBe(rust);
    expect(key("apps")).not.toBe(key("waveform"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
