import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { expect, test, vi } from "vitest";

import {
  docsOnly,
  markdownOnly,
  verificationJobs,
  verificationPassed,
  verificationMode,
} from "../../scripts/verification-scope.mjs";

test("manual admin E2E is absent while remaining build evidence stays required", () => {
  const needs: Record<string, { result: string; outputs?: Record<string, string> }> = {
    changes: { result: "success", outputs: { docs_only: "false", mode: "full" } },
    partial: { result: "skipped" },
    source_verification: { result: "skipped" },
    infra: { result: "success" },
    quality: { result: "success" },
    unit: { result: "success" },
    waveform: { result: "success" },
    postgres_integration: { result: "success" },
    app_build: { result: "success" },
    build: { result: "success" },
  };
  expect(verificationPassed(needs)).toBe(true);
  delete needs.app_build;
  expect(verificationPassed(needs)).toBe(false);
});

test.each(["success", "failure", "cancelled", "skipped", "missing"])(
  "gate requires exact evidence: %s",
  (result) => {
    for (const docs of [true, false]) {
      const needs: Record<string, { result: string; outputs?: Record<string, string> }> =
        Object.fromEntries(
          verificationJobs.map((name) => [name, { result: docs ? "skipped" : "success" }]),
        );
      needs.partial = needs.source_verification = { result: "skipped" };
      needs.changes = {
        result: "success",
        outputs: { docs_only: String(docs), mode: docs ? "docs" : "full" },
      };
      expect(verificationPassed(needs)).toBe(true);
      needs.unit = { result };
      expect(verificationPassed(needs)).toBe(result === (docs ? "skipped" : "success"));
      needs.partial = needs.source_verification = { result: "skipped" };
      needs.changes = {
        result: "failure",
        outputs: { docs_only: String(docs), mode: docs ? "docs" : "full" },
      };
      expect(verificationPassed(needs)).toBe(false);
    }
  },
);

test.each([
  {},
  { changes: { result: "success", outputs: {} } },
  { changes: { result: "skipped" } },
])("gate rejects absent scope/job proof", (needs) => {
  expect(verificationPassed(needs)).toBe(false);
});

test.each([
  ["migration_main", true, "partial"],
  ["migration_main", false, "full"],
  ["migration_main", undefined, "full"],
  ["migration_develop", true, "promotion"],
  ["migration_develop", false, "promotion"],
  ["other", true, "full"],
])("PR base=%s draft=%s selects %s", (ref, draft, mode) => {
  expect(
    verificationMode({
      eventName: "pull_request",
      event: { pull_request: { base: { ref }, draft } },
    }),
  ).toBe(mode);
});

test.each(["partial", "promotion"])(
  "%s requires exact selected checks and rejects heavy checks being silently lost",
  (mode) => {
    const needs: Record<string, { result: string; outputs?: Record<string, string> }> =
      Object.fromEntries(verificationJobs.map((name) => [name, { result: "skipped" }]));
    needs.changes = { result: "success", outputs: { docs_only: "false", mode } };
    needs.partial = { result: mode === "partial" ? "success" : "skipped" };
    needs.source_verification = { result: mode === "promotion" ? "success" : "skipped" };
    expect(verificationPassed(needs)).toBe(true);
    const selected = mode === "partial" ? "partial" : "source_verification";
    needs[selected] = { result: "failure" };
    expect(verificationPassed(needs)).toBe(false);
  },
);

test("Draft 결과는 병합 필수 verify라는 이름으로 게시하지 않고 Ready 전환에 전체 검증을 건다", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/verify.yml", import.meta.url),
    "utf8",
  );
  expect(workflow).toContain("ready_for_review");
  expect(workflow).toContain("converted_to_draft");
  expect(workflow).toContain("'partial verify' || 'verify'");
  expect(workflow).toContain("VERIFY_BASE: ${{ github.event.pull_request.base.sha }}");
});

test.each([
  "",
  "malformed\0README.md\0",
  ":100644 100644 " + "a".repeat(40) + " " + "b".repeat(40) + " M\0README.md",
])("ambiguous diff requires full verification", (raw) => {
  expect(markdownOnly(raw)).toBe(false);
});

test("real Git handles entire branch, rename, delete, modes, large diffs and hook environment", () => {
  const root = mkdtempSync(join(tmpdir(), "verification-scope-"));
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const write = (name: string, content = "fixture") => {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), content);
  };
  const commit = () => {
    git("add", ".");
    git(
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "fixture",
    );
    return git("rev-parse", "HEAD");
  };
  try {
    git("init", "-q");
    git("checkout", "-qb", "feature/docs");
    write("README.md");
    write("app.ts");
    write("script.md");
    write(
      "scripts/verification-scope.mjs",
      readFileSync(new URL("../../scripts/verification-scope.mjs", import.meta.url), "utf8"),
    );
    const base = commit();
    git("update-ref", "refs/remotes/origin/migration_main", base);
    const scope = (baseRef = "migration_main", eventName = "pull_request") =>
      docsOnly({
        cwd: root,
        eventName,
        event: {
          pull_request: {
            base: { ref: baseRef, sha: base },
            head: { sha: git("rev-parse", "HEAD") },
          },
        },
      });
    expect(scope()).toBe(false); // no changes
    write("docs/space and\nnewline.md");
    commit();
    expect(scope()).toBe(true);
    expect(scope("migration_develop")).toBe(false);
    expect(scope("migration_main", "push")).toBe(false);
    expect(docsOnly({ cwd: root, local: true })).toBe(true);
    const fakeBin = join(root, ".git/fixture-bin");
    mkdirSync(fakeBin);
    writeFileSync(join(fakeBin, "pnpm"), "#!/bin/sh\nexit 77\n", { mode: 0o755 });
    const pushHook = () =>
      spawnSync("sh", [new URL("../../.husky/pre-push", import.meta.url).pathname], {
        cwd: root,
        env: { ...env, PATH: fakeBin + ":" + process.env.PATH },
        encoding: "utf8",
        timeout: 10_000,
      });
    expect(pushHook().status).toBe(0); // no pnpm command is executed
    git("branch", "-m", "migration_main");
    expect(docsOnly({ cwd: root, local: true })).toBe(false);
    git("branch", "-m", "feature/docs");
    vi.stubEnv("GIT_DIR", "/nonexistent/inherited-hook-dir");
    expect(scope()).toBe(true);
    vi.unstubAllEnvs();
    git("mv", "README.md", "renamed.md");
    commit();
    expect(scope()).toBe(true);
    git("rm", "renamed.md");
    commit();
    expect(scope()).toBe(true);
    for (let i = 0; i < 350; i++) write(`docs/${i}.md`);
    commit();
    expect(scope()).toBe(true);
    write("app.ts", "changed code");
    commit();
    write("docs/final.md");
    commit();
    expect(scope()).toBe(false); // earlier code commit still counts
    expect(pushHook().status).toBe(77); // mixed branches enter the original checks
    git("reset", "--hard", base);
    git("mv", "app.ts", "app.md");
    commit();
    expect(scope()).toBe(false);
    git("reset", "--hard", base);
    chmodSync(join(root, "script.md"), 0o755);
    commit();
    expect(scope()).toBe(false);
    git("reset", "--hard", base);
    symlinkSync("README.md", join(root, "linked.md"));
    commit();
    expect(scope()).toBe(false);
    git("reset", "--hard", base);
    write("page.mdx");
    commit();
    expect(scope()).toBe(false);
    git("update-ref", "-d", "refs/remotes/origin/migration_main");
    expect(docsOnly({ cwd: root, local: true })).toBe(false);
    expect(docsOnly({ cwd: root, eventName: "pull_request", event: {} })).toBe(false);
  } finally {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
});
