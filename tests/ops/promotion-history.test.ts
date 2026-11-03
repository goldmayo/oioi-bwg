import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

import { assertSameTree, prepare } from "../../ops/oci/promotion.mjs";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "promotion-history-"));
  roots.push(root);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, env, encoding: "utf8", stdio: "pipe" }).trim();
  const commit = (file: string, value: string, message: string) => {
    writeFileSync(join(root, file), value);
    git("add", file);
    git("commit", "-qm", message);
  };
  git("init", "-q", "-b", "migration_main");
  git("config", "user.name", "fixture");
  git("config", "user.email", "fixture@example.invalid");
  commit("app.txt", "release-0\n", "initial");
  git("branch", "migration_develop");
  const feature = (cycle: number) => {
    git("switch", "-q", "migration_main");
    git("switch", "-qc", `feature/${cycle}`);
    commit("app.txt", `release-${cycle}\n`, `feature ${cycle}`);
    git("switch", "-q", "migration_main");
    git("merge", "--squash", `feature/${cycle}`);
    git("commit", "-qm", `feature squash ${cycle}`);
  };
  const preview = () =>
    git("merge-tree", "--write-tree", "migration_develop", "migration_main").split("\n")[0];
  const adapter = () => {
    const source = git("rev-parse", "migration_main");
    const base = git("rev-parse", "migration_develop");
    const merge = git("commit-tree", preview(), "-p", base, "-p", source, "-m", "preview");
    const pr = {
      number: 1,
      state: "open",
      draft: false,
      merge_commit_sha: merge,
      base: { ref: "migration_develop", sha: base },
      head: { ref: "migration_main", sha: source, repo: { full_name: "owner/repo" } },
    };
    const context = {
      repo: { owner: "owner", repo: "repo" },
      sha: merge,
      payload: { pull_request: structuredClone(pr) },
    };
    const github = {
      rest: {
        pulls: { get: async () => ({ data: pr }) },
        repos: {
          getBranch: async ({ branch }: { branch: string }) => ({
            data: { commit: { sha: git("rev-parse", branch) } },
          }),
        },
        git: {
          getCommit: async ({ commit_sha }: { commit_sha: string }) => ({
            data: {
              tree: { sha: git("rev-parse", `${commit_sha}^{tree}`) },
              parents: git("rev-list", "--parents", "-n", "1", commit_sha)
                .split(" ")
                .slice(1)
                .map((sha) => ({ sha })),
            },
          }),
        },
      },
    };
    return { github, context, pr, core: { setOutput: vi.fn() }, source, base };
  };
  return { git, commit, feature, preview, adapter };
}

test("세 차례 feature squash와 Promotion merge에서 main 역병합 없이 검증된 tree를 보존한다", async () => {
  const f = fixture();
  for (const cycle of [1, 2, 3]) {
    f.feature(cycle);
    const a = f.adapter();
    const sourceTree = f.git("rev-parse", `${a.source}^{tree}`);
    if (cycle > 1) {
      expect(() => f.git("merge-base", "--is-ancestor", a.base, a.source)).toThrow();
    }
    await expect(prepare(a)).resolves.toBe(sourceTree);
    f.git("switch", "-q", "migration_develop");
    f.git("merge", "--no-ff", "migration_main", "-m", `promotion ${cycle}`);
    expect(f.git("rev-parse", "HEAD^1")).toBe(a.base);
    expect(f.git("rev-parse", "HEAD^2")).toBe(a.source);
    expect(() => assertSameTree(sourceTree, f.git("rev-parse", "HEAD^{tree}"))).not.toThrow();
  }
});

test("동일 파일을 반복 squash하면 두 번째 배포에서 실제 Git 충돌이 생긴다", () => {
  const f = fixture();
  f.feature(1);
  f.git("switch", "-q", "migration_develop");
  f.git("merge", "--squash", "migration_main");
  f.git("commit", "-qm", "old promotion squash");
  f.feature(2);
  expect(() => f.preview()).toThrow();
});

test("develop에만 있는 파일이 합쳐진 미검증 tree는 배포 후보로 받아들이지 않는다", async () => {
  const f = fixture();
  f.feature(1);
  f.git("switch", "-q", "migration_develop");
  f.commit("develop-only.txt", "unreviewed\n", "develop drift");
  const a = f.adapter();
  expect(() => assertSameTree(f.git("rev-parse", "migration_main^{tree}"), f.preview())).toThrow();
  await expect(prepare(a)).rejects.toThrow("tree mismatch");
});

test.each([false, true])(
  "실행 중 develop이 바뀌면 이전 merge 검증을 거절한다: live PR 갱신=%s",
  async (updatePr) => {
    const f = fixture();
    f.feature(1);
    const a = f.adapter();
    f.git("switch", "-q", "migration_develop");
    f.commit("later.txt", "changed\n", "advance base");
    if (updatePr) a.pr.base.sha = f.git("rev-parse", "migration_develop");
    await expect(prepare(a)).rejects.toThrow("Promotion base changed");
    expect(a.core.setOutput).not.toHaveBeenCalled();
  },
);
