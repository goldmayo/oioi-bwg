import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { expect, test } from "vitest";

import { buildConfigHash, releaseId } from "../../ops/oci/promotion.mjs";
import { planImages } from "../../ops/oci/release-baseline.mjs";

test("uses the installed Turbo graph and real Git history for each app and shared package", () => {
  const root = mkdtempSync(join(tmpdir(), "turbo-release-"));
  try {
    for (const file of [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "turbo.json",
      ".gitignore",
      ...["apps/web", "apps/console", "packages/server", "packages/contracts"].map(
        (p) => p + "/package.json",
      ),
    ]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      copyFileSync(file, join(root, file));
    }
    mkdirSync(join(root, "node_modules"), { recursive: true });
    symlinkSync(resolve("node_modules/turbo"), join(root, "node_modules/turbo"), "dir");
    const git = (args: string[]) =>
      execFileSync("git", args, {
        cwd: root,
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
    let sourceSha = commit();
    for (const app of ["web", "console", "shared", "rename"]) {
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
          join(root, app === "shared" ? "packages/server/fixture.ts" : `apps/${app}/fixture.ts`),
          `// ${app}\n`,
        );
      }
      const head = commit();
      const execute = (command: string, args: string[], options: object = {}) =>
        execFileSync(
          command === "pnpm" ? resolve("node_modules/.bin/turbo") : command,
          command === "pnpm" ? args.slice(2) : args,
          { ...options, cwd: root, encoding: "utf8" },
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
  }
});
