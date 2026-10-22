import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

function loadAppConfig(app, cwd, ephemeralBuild, environment = {}) {
  const appDirectory = path.join(repositoryRoot, "apps", app);
  // Isolate module/env caches; never enable source map upload in the harness.
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `import { pathToFileURL } from "node:url";
       const { default: config } = await import(pathToFileURL(process.argv[1]).href);
       process.stdout.write(JSON.stringify(config));`,
      path.join(appDirectory, "next.config.ts"),
    ],
    {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
      env: {
        ...process.env,
        SENTRY_SOURCE_MAPS_ENABLED: "false",
        NEXT_PUBLIC_APP_ENV: "local",
        OIOI_EPHEMERAL_BUILD: ephemeralBuild,
        ...environment,
      },
    },
  );
  return JSON.parse(output);
}

test("Next app entries preserve tracing roots, shared build cache policy and Console auth", () => {
  for (const ephemeralBuild of ["", "false", "true"]) {
    const configs = {};
    for (const app of ["web", "console"]) {
      const appDirectory = path.join(repositoryRoot, "apps", app);
      const config = loadAppConfig(app, repositoryRoot, ephemeralBuild);
      assert.deepEqual(loadAppConfig(app, appDirectory, ephemeralBuild), config);
      assert.equal(config.output, "standalone");
      assert.equal(config.outputFileTracingRoot, repositoryRoot);
      assert.equal(config.experimental.turbopackFileSystemCacheForBuild, ephemeralBuild !== "true");
      configs[app] = config;
    }

    assert.equal(configs.web.experimental.authInterrupts, undefined);
    assert.equal(configs.console.experimental.authInterrupts, true);
    delete configs.console.experimental.authInterrupts;
    assert.deepEqual(configs.console, configs.web);
  }
});

test("Next app entries validate explicit local/production before building", () => {
  for (const app of ["web", "console"]) {
    assert.equal(
      loadAppConfig(app, repositoryRoot, "true", { NEXT_PUBLIC_APP_ENV: "production" }).output,
      "standalone",
    );
    for (const value of [undefined, "", "staging", "development", "INPUT_MARKER"]) {
      assert.throws(
        () => loadAppConfig(app, repositoryRoot, "true", { NEXT_PUBLIC_APP_ENV: value }),
        /NEXT_PUBLIC_APP_ENV must be local or production\./,
      );
    }
  }
});
