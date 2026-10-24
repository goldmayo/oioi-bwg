import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");

function readProject(filename) {
  const configPath = path.join(root, filename);
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configPath));
  assert.deepEqual(parsed.errors, []);
  return parsed;
}

test("every tracked TypeScript test has exactly one primary type owner", () => {
  const projects = [
    "tsconfig.json",
    "tsconfig.config.json",
    "scripts/tsconfig.json",
    "apps/web/tsconfig.json",
    "apps/web/tsconfig.config.json",
    "apps/console/tsconfig.json",
    "apps/console/tsconfig.config.json",
    "apps/sentry-slack-relay/tsconfig.json",
    "packages/server/tsconfig.json",
    "packages/server/tsconfig.config.json",
    "packages/contracts/tsconfig.json",
    "packages/contracts/tsconfig.config.json",
    "packages/config/tsconfig.json",
    "tests/tsconfig.json",
    "tests/tsconfig.web.json",
  ].map((config) => ({ config, project: readProject(config) }));
  const tests = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((file) => /\.(?:test|spec)\.[cm]?tsx?$/.test(file));
  assert.ok(tests.length > 0);
  for (const file of tests) {
    // fileNames는 include로 소유한 진입점이다. import로 방문한 파일과 구분한다.
    const owners = projects.filter(({ project }) =>
      project.fileNames.includes(path.join(root, file)),
    );
    assert.equal(owners.length, 1, `${file}: ${owners.map(({ config }) => config).join(", ")}`);
  }
  assert.ok(projects.every(({ project }) => project.options.strict && project.options.noEmit));
});

test("workspace config entries have one local type owner and keep Node aliases isolated", () => {
  const directories = [
    "apps/web",
    "apps/console",
    "packages/server",
    "packages/contracts",
    "apps/sentry-slack-relay",
    "packages/config",
  ];
  const rootSettings = readProject("tsconfig.config.json");
  for (const directory of directories) {
    const configFile = `${directory}/tsconfig.config.json`;
    const programs = [readProject(`${directory}/tsconfig.json`)];
    if (fs.existsSync(path.join(root, configFile))) {
      const node = readProject(configFile);
      assert.equal(node.options.paths, undefined, directory);
      programs.push(node);
    }
    const entries = execFileSync("git", ["ls-files", "-z", "--", directory], {
      cwd: root,
      encoding: "utf8",
    })
      .split("\0")
      .filter((file) => path.dirname(file) === directory && /\.config\.[cm]?ts$/.test(file));
    assert.ok(entries.length > 0, directory);
    for (const file of entries) {
      const absolute = path.join(root, file);
      assert.equal(
        programs.filter(({ fileNames }) => fileNames.includes(absolute)).length,
        1,
        file,
      );
      assert.ok(!rootSettings.fileNames.includes(absolute), `${file} must be owned locally`);
    }
    assert.ok(programs.every(({ options }) => options.strict && options.noEmit));
  }
});

test("the contracts type program rejects errors inside its real test entry", () => {
  const project = readProject("packages/contracts/tsconfig.json");
  const filename = path.join(root, "packages/contracts/src/contract.test.ts");
  const source = fs.readFileSync(filename, "utf8") + "\nconst invalid: string = 42;\n";
  const host = ts.createCompilerHost(project.options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (file, version, onError, fresh) =>
    file === filename
      ? ts.createSourceFile(file, source, version)
      : original(file, version, onError, fresh);
  const program = ts.createProgram(project.fileNames, project.options, host);
  assert.ok(
    ts
      .getPreEmitDiagnostics(program)
      .some(({ file, code }) => file?.fileName === filename && code === 2322),
  );
});

test("repo type programs cover every tracked operational TypeScript source", () => {
  const projects = [
    readProject("tsconfig.json"),
    readProject("scripts/tsconfig.json"),
    readProject("apps/sentry-slack-relay/tsconfig.json"),
  ];
  const included = new Set(projects.flatMap(({ fileNames }) => fileNames));
  const sources = execFileSync(
    "git",
    ["ls-files", "-z", "--", "scripts", "apps/sentry-slack-relay"],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter((filename) => /\.[cm]?ts$/.test(filename) && !filename.endsWith(".d.ts"));
  assert.ok(sources.length > 0);
  for (const filename of sources) {
    assert.ok(included.has(path.join(root, filename)), `${filename} must be type checked`);
  }
  assert.ok(projects.every(({ options }) => options.strict && options.noEmit));
  assert.equal(projects[1].options.allowJs, false);
  assert.equal(projects[2].options.paths, undefined);
  const worker = path.join(root, "apps/sentry-slack-relay/src/index.mts");
  assert.ok(projects[2].fileNames.includes(worker));
  assert.ok(!projects[0].fileNames.includes(worker));
});

test("root settings and tests have strict type owners without leaking Web aliases", () => {
  const config = readProject("tsconfig.config.json");
  for (const filename of [
    "drizzle.config.ts",
    "tests/ops/vitest.config.ts",
    "tests/integration/vitest.config.ts",
  ])
    assert.ok(config.fileNames.includes(path.join(root, filename)), `${filename} needs an owner`);

  const node = readProject("tests/tsconfig.json");
  const web = readProject("tests/tsconfig.web.json");
  const sources = execFileSync("git", ["ls-files", "-z", "--", "tests"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((filename) => filename.endsWith(".ts") && !filename.endsWith("/vitest.config.ts"));
  assert.ok(sources.length > 0);
  for (const filename of sources) {
    const absolute = path.join(root, filename);
    assert.equal(
      Number(node.fileNames.includes(absolute)) + Number(web.fileNames.includes(absolute)),
      1,
      `${filename} must have exactly one root test type owner`,
    );
  }
  assert.equal(node.options.paths, undefined);
  assert.deepEqual(web.options.paths, { "@/*": ["./src/*"] });
  assert.ok([config, node, web].every(({ options }) => options.strict && options.noEmit));
  const server = readProject("packages/server/tsconfig.json");
  assert.ok(server.options.strict && server.options.noEmit);
  assert.equal(server.options.paths, undefined);
  const serverTests = execFileSync("git", ["ls-files", "-z", "--", "packages/server/tests"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => file.endsWith(".ts"));
  assert.equal(serverTests.length, 2);
  for (const filename of serverTests) {
    const absolute = path.join(root, filename);
    assert.ok(server.fileNames.includes(absolute), `${filename} needs the server type owner`);
    assert.ok(!node.fileNames.includes(absolute) && !web.fileNames.includes(absolute));
  }
});

test("script type checking rejects bad values and connection APIs on transactions", () => {
  const project = readProject("scripts/tsconfig.json");
  const filename = path.join(root, "scripts/type-check-regression.ts");
  const source = [
    'import type { TransactionSql } from "postgres";',
    "declare const transaction: TransactionSql;",
    "const value: string = 42;",
    "transaction.end();",
    "transaction.begin(() => {});",
    'transaction`select ${Symbol("invalid")}`;',
    "transaction<{ id: number }[]>`select 1 as id`.then((rows) => { const id: string = rows[0]!.id; });",
    'transaction`select * from ${transaction("Album")}`;',
  ].join("\n");
  const host = ts.createCompilerHost(project.options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) =>
    file === filename
      ? ts.createSourceFile(file, source, languageVersion)
      : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([...project.fileNames, filename], project.options, host);
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter(({ file }) => file?.fileName === filename);
  const locations = errors.map(({ code, start, file }) => [
    file.getLineAndCharacterOfPosition(start).line + 1,
    code,
  ]);
  for (const [line, code] of [
    [3, 2322],
    [4, 2339],
    [5, 2339],
    [6, 2345],
    [7, 2322],
  ]) {
    assert.ok(
      locations.some(([actualLine, actualCode]) => actualLine === line && actualCode === code),
      `line ${line} must reject with TS${code}`,
    );
  }
  assert.ok(
    locations.every(([line]) => line >= 3 && line <= 7),
    JSON.stringify(locations),
  );
});
