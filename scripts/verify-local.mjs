import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** @param {{ files: string[], existingFiles?: string[], base: string, packages: { name: string, path: string }[] }} input */
export function localVerificationPlan({ files, existingFiles = files, base, packages }) {
  const changes = files.filter((file) => !file.endsWith(".md") && !file.startsWith(".impeccable/"));
  if (!changes.length) return [];
  const repo = changes.some(
    (file) =>
      (!file.startsWith("apps/") && !file.startsWith("packages/")) ||
      /(?:^|\/)(?:package\.json|tsconfig[^/]*\.json|\w+\.config\.[^/]+)$/.test(file) ||
      file.startsWith("packages/config/"),
  );
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
  const product = packages.some(({ name }) => name !== "@oioi-bwg/repository-tools");
  if (product)
    commands.push(
      [
        "exec",
        "turbo",
        "run",
        "type-check",
        "lint",
        "--affected",
        "--filter=!@oioi-bwg/repository-tools",
      ],
      [
        "exec",
        "turbo",
        "run",
        "test",
        "--affected",
        "--filter=!@oioi-bwg/repository-tools",
        "--",
        `--changed=${base}`,
        "--passWithNoTests",
      ],
    );
  if (repo)
    commands.push(
      ["type-check:repo"],
      ["lint:repo"],
      ["lint:deps"],
      ["test:harness"],
      ["test:ops", `--changed=${base}`, "--passWithNoTests"],
    );
  else if (packages.length)
    commands.push([
      "--filter",
      "@oioi-bwg/repository-tools",
      "lint:deps",
      ...packages.flatMap(({ path }) => ["--scope", path]),
    ]);
  const formatted = changes.filter((file) => existingFiles.includes(file));
  if (formatted.length)
    commands.push(["exec", "prettier", "--check", "--ignore-unknown", "--", ...formatted]);
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
  if (!files.some((file) => !file.endsWith(".md") && !file.startsWith(".impeccable/"))) {
    console.log("검증할 코드 변경이 없습니다.");
    return;
  }
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = JSON.parse(
    execFileSync(pnpm, ["exec", "turbo", "ls", "--affected", "--output=json"], {
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
