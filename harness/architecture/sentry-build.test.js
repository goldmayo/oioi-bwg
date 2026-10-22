import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
let configLoad = 0;

async function loadBuildConfig(app, environment) {
  const appDirectory = path.join(repositoryRoot, "apps", app);
  const result = await build({
    entryPoints: [path.join(appDirectory, "next.config.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    define: {
      "import.meta.dirname": JSON.stringify(appDirectory),
      "process.env": JSON.stringify({ NEXT_PUBLIC_APP_ENV: "local", ...environment }),
    },
    plugins: [
      {
        name: "capture-sentry-build-options",
        setup(builder) {
          builder.onResolve({ filter: /^@sentry\/nextjs$/ }, () => ({
            path: "sdk",
            namespace: "sentry-build-capture",
          }));
          // Only replace the SDK boundary. The app parser and config assembly stay real.
          builder.onLoad({ filter: /.*/, namespace: "sentry-build-capture" }, () => ({
            contents: `export function withSentryConfig(nextConfig, options) {
              return { nextConfig, options };
            }`,
            loader: "js",
          }));
        },
      },
    ],
  });
  const source = Buffer.from(result.outputFiles[0].text).toString("base64");
  return (await import(`data:text/javascript;base64,${source}#${configLoad++}`)).default;
}

function uploadEnvironment(app) {
  return {
    SENTRY_SOURCE_MAPS_ENABLED: "true",
    SENTRY_AUTH_TOKEN: ` test-${app}-token `,
    SENTRY_ORG: ` test-${app}-org `,
    SENTRY_PROJECT: ` test-${app}-project `,
    SENTRY_RELEASE: ` oioi-bwg@${(app === "web" ? "a" : "b").repeat(40)} `,
  };
}

test("Sentry build wrapping stays opt-in without requiring upload credentials", async () => {
  for (const app of ["web", "console"]) {
    for (const enabled of [undefined, "false", "TRUE"]) {
      const config = await loadBuildConfig(app, {
        SENTRY_SOURCE_MAPS_ENABLED: enabled,
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_SENTRY_DSN: "https://public@example.invalid/1",
      });
      assert.equal(config.output, "standalone");
      assert.equal(config.outputFileTracingRoot, repositoryRoot);
      assert.equal(config.options, undefined);
    }
  }
});

test("Sentry build uses each app's inputs and preserves release, cleanup and upload failure policy", async () => {
  for (const app of ["web", "console"]) {
    const environment = uploadEnvironment(app);
    const { nextConfig, options } = await loadBuildConfig(app, environment);
    assert.equal(nextConfig.outputFileTracingRoot, repositoryRoot);
    assert.equal(nextConfig.experimental.authInterrupts, app === "console" ? true : undefined);
    assert.equal(options.authToken, environment.SENTRY_AUTH_TOKEN.trim());
    assert.equal(options.org, environment.SENTRY_ORG.trim());
    assert.equal(options.project, environment.SENTRY_PROJECT.trim());
    assert.equal(options.telemetry, false);
    assert.equal(options.routeManifestInjection, false);
    assert.equal(options.suppressOnRouterTransitionStartWarning, true);
    assert.deepEqual(options.release, {
      name: environment.SENTRY_RELEASE.trim(),
      create: true,
      finalize: true,
    });
    assert.deepEqual(options.sourcemaps.filesToDeleteAfterUpload, [".next/**/*.map"]);
    const uploadError = new Error("synthetic upload failure");
    assert.throws(
      () => options.errorHandler(uploadError),
      (error) => error === uploadError,
    );
  }
});

test("Sentry build rejects missing credentials and invalid releases before SDK wrapping", async () => {
  for (const app of ["web", "console"]) {
    for (const name of ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_RELEASE"]) {
      await assert.rejects(
        loadBuildConfig(app, { ...uploadEnvironment(app), [name]: " " }),
        new RegExp(name),
      );
    }
    await assert.rejects(
      loadBuildConfig(app, { ...uploadEnvironment(app), SENTRY_RELEASE: "latest" }),
      /40-character lowercase git SHA/,
    );
  }
});
