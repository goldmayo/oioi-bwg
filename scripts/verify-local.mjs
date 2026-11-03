import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function isLocalDocumentation(file) {
  return (
    file.endsWith(".md") ||
    file.startsWith(".impeccable/") ||
    /^docs\/.*\.(?:txt|png|jpe?g|webp|gif|svg|html|json|woff2?)$/.test(file)
  );
}

function isGlobalProductInput(file) {
  return /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|\.nvmrc|tsconfig[^/]*\.json|eslint\.config\.[^/]+|vitest\.config\.[^/]+)$/.test(
    file,
  );
}

function isRootLintConfig(file) {
  return /^(?:oxlint\.config\.[^/]+|\.oxlintrc\.jsonc?)$/.test(file);
}

export function workspaceFilters(files, packages) {
  if (files.some(isGlobalProductInput)) return [];
  return packages
    .filter(({ path }) => files.some((file) => file.startsWith(`${path}/`)))
    .map(({ name }) => `--filter=...${name}`);
}

/** @param {{ files: string[], existingFiles?: string[], base: string, packages: { name: string, path: string }[] }} input */
export function localVerificationPlan({ files, existingFiles = files, base, packages }) {
  const changes = files.filter((file) => !isLocalDocumentation(file));
  if (!changes.length) return [];
  const repo = changes.some(
    (file) =>
      isGlobalProductInput(file) ||
      isRootLintConfig(file) ||
      /^(?:packages\/config\/(?:typescript|eslint|oxlint)|tools\/repository)\//.test(file),
  );
  const rootFiles = changes.filter((file) => !/^(?:apps|packages|tools)\//.test(file));
  const unknown = rootFiles.filter(
    (file) =>
      !/^(?:(?:ops|scripts|tests|infra|\.github|\.husky|\.vscode)\/.*|[^/]+\.(?:jsonc?|ya?ml|[cm]?[jt]s)|\.(?:nvmrc|npmrc|gitignore|gitattributes|dockerignore|prettierignore|prettierrc)|LICENSE|\.env\.example)$/.test(
        file,
      ),
  );
  if (unknown.length)
    throw new Error(`로컬 검증 소유 범위를 확인할 수 없습니다: ${unknown.join(", ")}`);
  const rootLint = rootFiles.filter(
    (file) => /\.[cm]?[jt]sx?$/.test(file) && existingFiles.includes(file),
  );
  const ops = changes.some((file) => /^(?:ops|scripts|tests|infra|\.github|\.husky)\//.test(file));
  const commands = [];
  if (
    changes.some(
      (file) =>
        /^(apps|packages)\//.test(file) &&
        !packages.some(({ path }) => file.startsWith(`${path}/`)),
    )
  )
    throw new Error(
      "변경 workspace가 Turbo 영향 범위에 없습니다. 기준과 workspace 등록을 확인해주세요.",
    );
  const product =
    changes.some(isGlobalProductInput) || changes.some((file) => /^(?:apps|packages)\//.test(file));
  if (product) {
    commands.push([
      "exec",
      "turbo",
      "run",
      "type-check",
      "lint",
      "--affected",
      ...workspaceFilters(changes, packages),
      "--filter=!@oioi-bwg/repository-tools",
    ]);
    commands.push([
      "exec",
      "turbo",
      "run",
      "test",
      "--affected",
      ...workspaceFilters(changes, packages),
      "--filter=!@oioi-bwg/repository-tools",
      "--",
      `--changed=${base}`,
      "--passWithNoTests",
    ]);
  }
  if (repo) commands.push(["type-check:repo"], ["lint:repo"], ["lint:deps"]);
  else if (product && packages.length)
    commands.push([
      "--filter",
      "@oioi-bwg/repository-tools",
      "lint:deps",
      ...packages.flatMap(({ path }) => ["--scope", path]),
    ]);
  if (!repo && rootLint.length)
    commands.push([
      "exec",
      "oxlint",
      "--type-aware",
      "--format=stylish",
      "--report-unused-disable-directives-severity",
      "warn",
      "--",
      ...rootLint,
    ]);
  if (!repo && changes.some((file) => /^scripts\/.*\.tsx?$/.test(file)))
    commands.push(["type-check:scripts"]);
  if (!repo && changes.some((file) => /^tests\/.*\.tsx?$/.test(file)))
    commands.push(["exec", "tsc", "--noEmit", "-p", "tests/tsconfig.json"]);
  if (repo || ops) commands.push(["test:ops", `--changed=${base}`, "--passWithNoTests"]);
  const harness = changes.filter(
    (file) =>
      /^tools\/repository\/harness\/.*\.test\.js$/.test(file) && existingFiles.includes(file),
  );
  if (harness.length) commands.push(["exec", "node", "--import", "tsx", "--test", ...harness]);
  const formatted = changes.filter((file) => existingFiles.includes(file));
  if (formatted.length)
    commands.push([
      "exec",
      "oxfmt",
      "--check",
      "--no-error-on-unmatched-pattern",
      "-c",
      ".oxfmtrc.json",
      "--",
      ...formatted,
    ]);
  return commands;
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run"))
    throw new Error(
      "로컬 검증은 --dry-run만 지원합니다. 전체 검증은 pnpm verify:full을 사용합니다.",
    );
  const root = fileURLToPath(new URL("../", import.meta.url));
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) if (key.startsWith("GIT_")) delete environment[key];
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, env: environment, encoding: "utf8" });
  // 전체 diff와 미커밋·신규 파일을 함께 보며, 기준을 못 읽으면 전체 검증을 몰래 실행하지 않는다.
  const base = git("merge-base", process.env.VERIFY_BASE ?? "origin/migration_main", "HEAD").trim();
  environment.TURBO_SCM_BASE = base;
  delete environment.TURBO_SCM_HEAD;
  const files = [
    ...new Set([
      ...git("diff", "--name-only", "-z", base, "--").split("\0"),
      ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0"),
    ]),
  ].filter(Boolean);
  if (files.every(isLocalDocumentation)) {
    console.log("검증할 코드 변경이 없습니다.");
    return;
  }
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const readPackages = (filters = []) => {
    const result = JSON.parse(
      execFileSync(pnpm, ["exec", "turbo", "ls", "--affected", ...filters, "--output=json"], {
        cwd: root,
        env: environment,
        encoding: "utf8",
      }),
    );
    const packages = result.packages?.items;
    if (
      !Array.isArray(packages) ||
      packages.some((item) => typeof item.name !== "string" || typeof item.path !== "string")
    )
      throw new Error("Turbo의 영향 범위를 해석하지 못했습니다.");
    return packages;
  };
  const affected = readPackages();
  // Root 문서/스크립트 때문에 --affected가 모든 제품을 선택하는 것을 제한한다.
  // 의존 그래프는 자체 구현하지 않고 Turbo의 dependents selector가 계산한다.
  const filters = workspaceFilters(
    files.filter((file) => !isLocalDocumentation(file)),
    affected,
  );
  const packages = filters.length ? readPackages(filters) : affected;
  const plan = localVerificationPlan({
    files,
    base,
    packages,
    existingFiles: files.filter((file) => existsSync(resolve(root, file))),
  });
  if (args.includes("--dry-run")) {
    console.log(JSON.stringify({ base, packages, commands: plan }, null, 2));
    return;
  }
  console.log(`로컬 변경 검증: ${packages.map(({ name }) => name).join(", ") || "저장소 도구"}`);
  for (const command of plan) {
    const result = spawnSync(pnpm, command, { cwd: root, env: environment, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "로컬 변경 검증 실패");
    process.exitCode = 1;
  }
}
