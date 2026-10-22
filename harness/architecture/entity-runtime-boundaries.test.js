import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

for (const app of ["web", "console"]) {
  const appRoot = path.join(repositoryRoot, "apps", app);

  test(`${app} entity roots keep browser acquisition outside the server import graph`, async () => {
    const result = await build({
      absWorkingDir: appRoot,
      entryPoints: ["src/entities/album/index.ts", "src/entities/song/index.ts"],
      outdir: "unused",
      bundle: true,
      packages: "external",
      platform: "node",
      format: "esm",
      treeShaking: false,
      metafile: true,
      write: false,
      logLevel: "silent",
    });

    // treeShaking:false로 사용하지 않는 재수출도 검사한다. client-only를 mock하지 않는다.
    for (const [filename, input] of Object.entries(result.metafile.inputs)) {
      assert.doesNotMatch(filename, /(?:http-client|api\/(?:api|queries|mutations))\.[jt]sx?$/);
      assert.ok(!input.imports.some(({ path }) => path === "client-only"), filename);
    }
    assert.ok(result.metafile.inputs["src/entities/album/api/query-keys.ts"]);
    assert.ok(result.metafile.inputs["src/entities/song/api/query-keys.ts"]);
  });

  test(`${app} browser API entries reach the marked HTTP transport`, async () => {
    const result = await build({
      absWorkingDir: appRoot,
      entryPoints: ["src/entities/album/api/index.ts", "src/entities/song/api/index.ts"],
      outdir: "unused",
      bundle: true,
      packages: "external",
      platform: "browser",
      format: "esm",
      metafile: true,
      write: false,
      logLevel: "silent",
    });

    const transport = result.metafile.inputs["src/shared/api/http-client.ts"];
    assert.ok(transport, "browser API must use the app HTTP transport");
    assert.ok(transport.imports.some(({ path }) => path === "client-only"));
  });
}
