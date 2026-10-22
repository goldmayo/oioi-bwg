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
      ...[
        "apps/web",
        "apps/console",
        "apps/sentry-slack-relay",
        "packages/server",
        "packages/contracts",
        "packages/config",
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
    for (const app of ["web", "console", "shared", "config", "sentry-slack-relay", "rename"]) {
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
      if (app === "rename") git(["mv", "apps/web/fixture.ts", "apps/console/moved.ts"]);
      else {
        writeFileSync(
          join(
            root,
            app === "shared"
              ? "packages/server/fixture.ts"
              : app === "config"
                ? "packages/config/fixture.ts"
                : `apps/${app}/fixture.ts`,
          ),
          `// ${app}\n`,
        );
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
      expect(result.build).toEqual({ web: app !== "console", console: app !== "web" });
      sourceSha = head;
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
    vi.unstubAllEnvs();
    expect(repositoryGit(["rev-parse", "HEAD"])).toBe(beforeHead);
    expect(repositoryGit(["ls-files", "--stage"])).toBe(beforeIndex);
  }
});
