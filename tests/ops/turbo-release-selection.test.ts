import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { expect, test, vi } from "vitest";

import { buildConfigHash, releaseId } from "../../ops/oci/promotion.mjs";
import { planImages } from "../../ops/oci/release-baseline.mjs";

test("uses the installed Turbo graph and real Git history for each app and shared package", () => {
  const repository = process.cwd();
  const cleanGitEnv = (environment: NodeJS.ProcessEnv = process.env) => ({
    ...Object.fromEntries(Object.entries(environment).filter(([name]) => !name.startsWith("GIT_"))),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
  });
  const repositoryGit = (args: string[]) =>
    execFileSync("git", args, { cwd: repository, env: cleanGitEnv(), encoding: "utf8" }).trim();
  const beforeHead = repositoryGit(["rev-parse", "HEAD"]);
  const beforeIndex = repositoryGit(["ls-files", "--stage"]);
  // Deliberately reproduce the Git variables exported by a push hook. Every
  // fixture subprocess (including Turbo's Git children) must strip them.
  vi.stubEnv("GIT_DIR", repositoryGit(["rev-parse", "--absolute-git-dir"]));
  vi.stubEnv("GIT_WORK_TREE", repository);
  vi.stubEnv("GIT_INDEX_FILE", resolve(repositoryGit(["rev-parse", "--git-path", "index"])));
  const root = mkdtempSync(join(tmpdir(), "turbo-release-"));
  try {
    for (const file of [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "turbo.json",
      ".gitignore",
      ".dockerignore",
      ".nvmrc",
      ...[
        "apps/web",
        "apps/console",
        "apps/sentry-slack-relay",
        "packages/server",
        "packages/contracts",
        "packages/config",
        "packages/ui",
        "tools/repository",
      ].map((p) => p + "/package.json"),
    ]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      copyFileSync(file, join(root, file));
    }
    mkdirSync(join(root, "node_modules"), { recursive: true });
    symlinkSync(resolve("node_modules/turbo"), join(root, "node_modules/turbo"), "dir");
    const git = (args: string[]) =>
      execFileSync("git", ["-C", root, ...args], {
        cwd: root,
        env: cleanGitEnv(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    const commit = () => {
      git(["add", "."]);
      git([
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        "fixture",
      ]);
      return git(["rev-parse", "HEAD"]);
    };
    git(["init", "-q"]);
    expect(git(["rev-parse", "--show-toplevel"])).toBe(root);
    let sourceSha = commit();
    for (const app of [
      "web",
      "console",
      "console-docs",
      "docs-only",
      "shared",
      "ui",
      "config",
      "sentry-slack-relay",
      "web-docker",
      "console-docker",
      "rename",
    ]) {
      const baseline = {
        prNumber: 142,
        sourceSha,
        sourceTree: git(["rev-parse", "HEAD^{tree}"]),
        runId: 17,
        runAttempt: 1,
        baseline: null,
        buildConfigHash: buildConfigHash(),
        images: Object.fromEntries(
          ["web", "console"].map((name) => [
            name,
            {
              repository: `registry.test/namespace/${name}`,
              digest: `sha256:${"a".repeat(64)}`,
              buildSourceSha: sourceSha,
              origin: "built",
            },
          ]),
        ),
      };
      const paths: Record<string, string> = {
        web: "apps/web/fixture.ts",
        console: "apps/console/fixture.ts",
        "console-docs": "apps/console/fixture.ts",
        "docs-only": "docs/note.md",
        shared: "packages/server/fixture.ts",
        ui: "packages/ui/fixture.ts",
        config: "packages/config/fixture.ts",
        "sentry-slack-relay": "apps/sentry-slack-relay/fixture.ts",
        "web-docker": "apps/web/Dockerfile",
        "console-docker": "apps/console/Dockerfile",
      };
      if (app === "rename") git(["mv", "apps/web/fixture.ts", "apps/console/moved.ts"]);
      else {
        const file = join(root, paths[app]);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, `// ${app}\n`);
        if (app === "console-docs") {
          mkdirSync(join(root, "docs"), { recursive: true });
          writeFileSync(join(root, "docs/mockup.png"), "evidence");
        }
      }
      const head = commit();
      const execute = (
        command: string,
        args: string[],
        options: { env?: NodeJS.ProcessEnv } = {},
      ) =>
        execFileSync(
          command === "pnpm" ? resolve("node_modules/.bin/turbo") : command,
          command === "pnpm" ? args.slice(2) : args,
          { ...options, cwd: root, encoding: "utf8", env: cleanGitEnv(options.env) },
        );
      const result = planImages({
        baseline,
        proof: { releaseId: releaseId(baseline), artifactId: 99, runId: 31, runAttempt: 1 },
        sourceSha: head,
        execute,
      });
      const expected: Record<string, { web: boolean; console: boolean }> = {
        web: { web: true, console: false },
        console: { web: false, console: true },
        "console-docs": { web: false, console: true },
        "docs-only": { web: false, console: false },
      };
      expect(result.build).toEqual(expected[app] ?? { web: true, console: true });
      sourceSha = head;
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
    vi.unstubAllEnvs();
    expect(repositoryGit(["rev-parse", "HEAD"])).toBe(beforeHead);
    expect(repositoryGit(["ls-files", "--stage"])).toBe(beforeIndex);
  }
});
