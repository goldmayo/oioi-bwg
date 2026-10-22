import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  for (const filename of ["drizzle.config.ts", "vitest.ops.config.ts"])
    assert.ok(config.fileNames.includes(path.join(root, filename)), `${filename} needs an owner`);

  const node = readProject("tests/tsconfig.json");
  const web = readProject("tests/tsconfig.web.json");
  const sources = execFileSync("git", ["ls-files", "-z", "--", "tests"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((filename) => filename.endsWith(".ts"));
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
