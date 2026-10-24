import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cruise } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";
import ts from "typescript";

import {
  dependencyOptions,
  workspaceDependencyErrors,
  type WorkspaceDependencyOwner,
} from "@oioi-bwg/config/dependencies";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(
    (file) =>
      /\.[cm]?[jt]sx?$/.test(file) &&
      !/^(?:docs|tests\/k6)\//.test(file) &&
      !file.endsWith("next-env.d.ts"),
  );
const owners: WorkspaceDependencyOwner[] = ["apps", "packages", "tools"].flatMap((folder) =>
  fs.readdirSync(path.join(root, folder)).flatMap((name) => {
    const directory = `${folder}/${name}`;
    const manifest = path.join(root, directory, "package.json");
    if (!fs.existsSync(manifest)) return [];
    const pkg = JSON.parse(fs.readFileSync(manifest, "utf8")) as Record<
      string,
      Record<string, string>
    > & { name: string };
    return [
      {
        directory,
        name: pkg.name,
        exports: pkg.exports,
        dependencies: {
          ...pkg.dependencies,
          ...pkg.devDependencies,
          ...pkg.peerDependencies,
          ...pkg.optionalDependencies,
        },
      },
    ];
  }),
);
const clients = files.filter((file) => {
  if (!file.startsWith("apps/")) return false;
  return ts
    .createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest)
    .statements.some(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) &&
        statement.expression.text === "use client",
    );
});
const webTests = "tests/integration/m7-foundation.postgres.test.ts";
const projects = [
  ...owners.flatMap(({ directory }) => {
    const config = `${directory}/tsconfig.config.json`;
    const hasSettings = fs.existsSync(path.join(root, config));
    const settings = new Set(hasSettings ? extractTSConfig(path.join(root, config)).fileNames : []);
    const inputs = files.filter((file) => file.startsWith(directory + "/"));
    return [
      {
        label: directory,
        config: `${directory}/tsconfig.json`,
        inputs: inputs.filter((file) => !settings.has(path.join(root, file))),
      },
      ...(hasSettings
        ? [
            {
              label: directory + ":config",
              config,
              inputs: inputs.filter((file) => settings.has(path.join(root, file))),
            },
          ]
        : []),
    ];
  }),
  {
    label: "repository",
    config: "tsconfig.config.json",
    // 실행 consumer가 없는 legacy introspection 파일은 진입점에서만 제외한다.
    inputs: files.filter(
      (file) =>
        !/^(?:apps|packages|tools)\//.test(file) &&
        file !== webTests &&
        file !== "drizzle/relations.ts",
    ),
  },
  { label: "web-integration", config: "tests/tsconfig.web.json", inputs: [webTests] },
];
let errors = workspaceDependencyErrors(owners);
for (const project of projects) {
  const config = path.join(root, project.config);
  const tsConfig = extractTSConfig(config);
  // paths가 baseUrl 없이 선언된 앱에서도 alias 기준은 소유 설정의 위치다.
  const cwd =
    (tsConfig.options as ts.CompilerOptions & { pathsBasePath?: string }).pathsBasePath ??
    path.dirname(config);
  process.chdir(cwd);
  const result = await cruise(
    project.inputs,
    dependencyOptions(root, tsConfig.options.paths ? config : undefined, owners, clients),
    {},
    { tsConfig },
  );
  if (typeof result.output === "string") throw new Error("의존성 분석 결과가 객체가 아닙니다.");
  errors.push(...workspaceDependencyErrors(owners, result.output.modules));
  for (const violation of result.output.summary.violations) {
    const message = `${violation.rule.name}: ${violation.from} → ${violation.to}`;
    if (violation.rule.severity === "error") errors.push(message);
    else console.warn(message);
  }
  console.log(
    `${project.label}: ${result.output.summary.totalCruised} modules, ${result.output.summary.error} graph errors`,
  );
}
process.chdir(root);
errors = [...new Set(errors)];
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
