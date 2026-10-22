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
  const projects = [readProject("tsconfig.json"), readProject("scripts/tsconfig.json")];
  const included = new Set(projects.flatMap(({ fileNames }) => fileNames));
  const sources = execFileSync("git", ["ls-files", "-z", "--", "scripts", "workers"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((filename) => /\.[cm]?ts$/.test(filename) && !filename.endsWith(".d.ts"));
  assert.ok(sources.length > 0);
  for (const filename of sources) {
    assert.ok(included.has(path.join(root, filename)), `${filename} must be type checked`);
  }
  assert.ok(projects.every(({ options }) => options.strict && options.noEmit));
  assert.equal(projects[1].options.allowJs, false);
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
