import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { localVerificationPlan, workspaceFilters } from "../../scripts/verify-local.mjs";

const packages = [{ name: "@oioi-bwg/console", path: "apps/console" }];
const base = "a".repeat(40);

test("Console UI 변경은 관련 프로젝트·테스트·경계만 검사한다", () => {
  const files = ["apps/console/src/page.tsx", "docs/WORK.md", ".impeccable/hook.cache.json"];
  const plan = localVerificationPlan({ files, base, packages });
  expect(plan[0]).toContain("--affected");
  expect(plan[0]).toContain("--filter=...@oioi-bwg/console");
  expect(plan[1]).toContain(`--changed=${base}`);
  expect(plan).toContainEqual([
    "--filter",
    "@oioi-bwg/repository-tools",
    "lint:deps",
    "--scope",
    "apps/console",
  ]);
  expect(plan.flat()).not.toContain("test:harness");
  expect(plan.flat()).not.toContain("test:ops");
  expect(plan.flat()).not.toContain("build");
  expect(plan.at(-1)).toEqual([
    "exec",
    "oxfmt",
    "--check",
    "--no-error-on-unmatched-pattern",
    "-c",
    ".oxfmtrc.json",
    "--",
    files[0],
  ]);
});

test("문서·Root 스크립트가 함께 바뀌어도 Console과 그 consumer만 선택한다", () => {
  const all = [...packages, { name: "@oioi-bwg/web", path: "apps/web" }];
  const files = ["apps/console/src/page.tsx", "scripts/verify-local.mjs", "docs/prototype/a.html"];
  expect(workspaceFilters(files, all)).toEqual(["--filter=...@oioi-bwg/console"]);
  expect(workspaceFilters([...files, "pnpm-lock.yaml"], all)).toEqual([]);
});

test("공용 설정 변경은 저장소 검사도 선택하되 운영 테스트는 관련 항목으로 제한한다", () => {
  const plan = localVerificationPlan({
    files: ["packages/config/typescript/base.json"],
    base,
    packages: [...packages, { name: "@oioi-bwg/config", path: "packages/config" }],
  });
  expect(plan).toContainEqual(["type-check:repo"]);
  expect(plan).toContainEqual(["lint:deps"]);
  expect(plan.flat()).not.toContain("test:harness");
  expect(plan).toContainEqual(["test:ops", `--changed=${base}`, "--passWithNoTests"]);
});

test.each([
  ".oxlintrc.json",
  ".oxlintrc.jsonc",
  "oxlint.config.ts",
  "oxlint.config.mts",
  "tools/repository/oxlint.config.ts",
])("Root·Tool lint 설정 %s 변경은 저장소 소유 검사만 실행한다", (file) => {
  expect(workspaceFilters([file], packages)).toEqual([]);
  const plan = localVerificationPlan({ files: [file], base, packages });
  expect(plan).toContainEqual(["type-check:repo"]);
  expect(plan).toContainEqual(["lint:repo"]);
  expect(plan).toContainEqual(["lint:deps"]);
  expect(plan.flat()).not.toContain("turbo");
  expect(plan.flat()).not.toContain("build");
});

test("공용 native lint 정책 변경은 config consumer와 저장소 검사를 함께 선택한다", () => {
  const file = "packages/config/oxlint/base.ts";
  const affected = [...packages, { name: "@oioi-bwg/config", path: "packages/config" }];
  const plan = localVerificationPlan({ files: [file], base, packages: affected });
  expect(plan[0]).toContain("--filter=...@oioi-bwg/config");
  expect(plan).toContainEqual(["type-check:repo"]);
  expect(plan).toContainEqual(["lint:repo"]);
  expect(plan).toContainEqual(["lint:deps"]);
});

test("workspace native 설정 변경은 해당 workspace와 consumer만 검사한다", () => {
  const file = "apps/console/oxlint.config.ts";
  const plan = localVerificationPlan({ files: [file], base, packages });
  expect(plan[0]).toContain("--filter=...@oioi-bwg/console");
  expect(plan[0]).toContain("--affected");
  expect(plan.flat()).not.toContain("lint:repo");
  expect(plan.flat()).not.toContain("build");
});

test("Root manifest 변경도 기존 affected 검사를 전체 lint로 바꾸지 않는다", () => {
  const plan = localVerificationPlan({ files: ["package.json"], base, packages });
  expect(plan[0]).toContain("type-check");
  expect(plan[0]).toContain("lint");
  expect(plan[0]).toContain("--affected");
  expect(
    plan.filter((command) => command.includes("lint") && !command.includes("--affected")),
  ).toEqual([]);
});

test("포맷 지원 대상이 없는 운영 파일도 검증 오류로 처리하지 않는다", () => {
  const file = "scripts/check-local.sh";
  const plan = localVerificationPlan({ files: [file], base, packages });
  const formatter = plan.at(-1);
  expect(formatter).toContain("oxfmt");
  expect(formatter).toContain("--check");
  expect(formatter).toContain("--no-error-on-unmatched-pattern");
  expect(formatter).toContain(file);
});

test("에디터 설정 변경은 제품과 저장소 전체 검사를 실행하지 않는다", () => {
  const plan = localVerificationPlan({
    files: [".vscode/settings.json", ".vscode/extensions.json"],
    base,
    packages,
  });
  expect(plan).toHaveLength(1);
  expect(plan[0]).toContain("oxfmt");
  expect(plan.flat()).not.toContain("turbo");
  expect(plan.flat()).not.toContain("lint:repo");
});

test("삭제만 한 소스도 검사하며 포맷에는 존재하는 파일만 전달한다", () => {
  const plan = localVerificationPlan({
    files: ["apps/console/src/deleted.ts"],
    existingFiles: [],
    base,
    packages,
  });
  expect(plan[0]).toContain("type-check");
  expect(plan[1]).toContain("test");
  expect(plan.flat()).not.toContain("oxfmt");
});

test("문서·빈 변경에는 코드 검사를 실행하지 않는다", () => {
  for (const files of [
    [],
    ["docs/WORK.md"],
    [".impeccable/hook.cache.json"],
    [
      "docs/prototype/screen.html",
      "docs/prototype/screen.png",
      "docs/prototype/font.woff2",
      "docs/prototype/OFL.txt",
    ],
  ])
    expect(localVerificationPlan({ files, base, packages })).toEqual([]);
});

test("브라우저 smoke 선택자 변경은 루트 전체 타입·아키텍처 검증으로 확대하지 않는다", () => {
  const file = "tests/ops/console-standalone-smoke.mjs";
  // Turbo가 root 변경을 모든 workspace로 반환해도 제품 검사로 확대하지 않는다.
  const plan = localVerificationPlan({ files: [file], base, packages });
  expect(plan).toContainEqual([
    "exec",
    "oxlint",
    "--type-aware",
    "--format=stylish",
    "--report-unused-disable-directives-severity",
    "warn",
    "--",
    file,
  ]);
  expect(plan.flat()).not.toContain("eslint");
  expect(plan).toContainEqual(["test:ops", `--changed=${base}`, "--passWithNoTests"]);
  for (const command of [
    "turbo",
    "type-check:repo",
    "lint:repo",
    "lint:deps",
    "test:harness",
    "build",
  ])
    expect(plan.flat()).not.toContain(command);
});

test("소유자가 없는 변경을 무거운 검사로 바꾸거나 조용히 생략하지 않는다", () => {
  expect(() =>
    localVerificationPlan({ files: ["unknown/new-file.py"], base, packages: [] }),
  ).toThrow("소유 범위");
});

test("Root 운영 테스트 수정은 Tool 테스트 타입 프로그램까지 반복하지 않는다", () => {
  const plan = localVerificationPlan({ files: ["tests/ops/verify-local.test.ts"], base, packages });
  expect(plan).toContainEqual(["exec", "tsc", "--noEmit", "-p", "tests/tsconfig.json"]);
  expect(plan.flat()).not.toContain("type-check:tests");
  expect(plan.flat()).not.toContain("turbo");
});

test("영향 workspace가 누락되면 검사를 성공으로 건너뛰지 않는다", () => {
  expect(() =>
    localVerificationPlan({ files: ["apps/unknown/source.ts"], base, packages: [] }),
  ).toThrow("Turbo 영향 범위");
});

test("로컬 증분과 CI 전체 검증 명령을 분리하고 캐시를 끄지 않는다", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  expect(manifest.scripts.verify).toBe("node scripts/verify-local.mjs");
  expect(manifest.scripts["verify:full"]).not.toMatch(/--affected|--changed/);
  const preset = JSON.parse(
    readFileSync(new URL("../../packages/config/typescript/base.json", import.meta.url), "utf8"),
  );
  expect(preset.compilerOptions.incremental).toBe(true);
  const turbo = JSON.parse(readFileSync(new URL("../../turbo.json", import.meta.url), "utf8"));
  expect(turbo.tasks.lint.outputs).toEqual([]);
  expect(JSON.stringify(turbo)).not.toContain(".cache/eslint");
  for (const app of ["web", "console"]) {
    const scripts = JSON.parse(
      readFileSync(new URL(`../../apps/${app}/package.json`, import.meta.url), "utf8"),
    ).scripts;
    expect(scripts["type-check"]).not.toContain("incremental false");
    expect(scripts["type-check"]).toContain("tsc --noEmit");
    expect(scripts.lint).toContain("oxlint --type-aware");
    expect(scripts.lint).not.toContain("--type-check");
    expect(scripts.lint).not.toMatch(/\beslint\b/);
    expect(scripts.lint).not.toContain("--config");
    expect(scripts.lint).toContain("--report-unused-disable-directives-severity warn");
  }
});

test("실제 Git의 삭제·신규 파일과 hook 환경을 처리하며 기준 오류를 전체 실행으로 바꾸지 않는다", () => {
  const root = mkdtempSync(join(tmpdir(), "verify-local-"));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  try {
    git("init", "-q");
    mkdirSync(join(root, "apps/console/src"), { recursive: true });
    mkdirSync(join(root, "scripts"));
    writeFileSync(join(root, "apps/console/src/old.ts"), "export const value = 1;");
    writeFileSync(
      join(root, "scripts/verify-local.mjs"),
      readFileSync(new URL("../../scripts/verify-local.mjs", import.meta.url)),
    );
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
    const base = git("rev-parse", "HEAD");
    unlinkSync(join(root, "apps/console/src/old.ts"));
    writeFileSync(join(root, "apps/console/src/new.ts"), "export const next = 2;");
    const bin = join(root, ".git/bin");
    mkdirSync(bin);
    writeFileSync(
      join(bin, "pnpm"),
      `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify({ packages: { items: packages } })}'\n`,
      { mode: 0o755 },
    );
    const run = (reference: string) =>
      spawnSync(process.execPath, [join(root, "scripts/verify-local.mjs"), "--dry-run"], {
        cwd: root,
        env: {
          ...env,
          GIT_DIR: "/nonexistent/hook",
          VERIFY_BASE: reference,
          PATH: `${bin}:${env.PATH}`,
        },
        encoding: "utf8",
      });
    const result = run(base);
    expect(result.status, result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout);
    expect(plan.commands[0]).toContain("--affected");
    expect(plan.commands.at(-1)).toContain("apps/console/src/new.ts");
    expect(plan.commands.at(-1)).not.toContain("apps/console/src/old.ts");
    expect(run("missing-ref").status).toBe(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
