import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import { createSentryBuildOptions } from "@oioi-bwg/config/sentry-build";

describe("GitHub Actions OCI Run Command deployment", () => {
  test("uses local verification builds and production VM candidates", async () => {
    const [workflow, ...dockerfiles] = await Promise.all([
      readFile(resolve(".github/workflows/verify.yml"), "utf8"),
      readFile(resolve("apps/web/Dockerfile"), "utf8"),
      readFile(resolve("apps/console/Dockerfile"), "utf8"),
    ]);
    const [verification, promotion] = workflow.split("  promotion-candidate:");
    expect(verification.match(/NEXT_PUBLIC_APP_ENV=local/g)).toHaveLength(3);
    expect(promotion.match(/NEXT_PUBLIC_APP_ENV=production/g)).toHaveLength(2);
    expect(promotion).toContain("NEXT_PUBLIC_APP_ENV: production");
    expect(workflow).not.toMatch(/NEXT_PUBLIC_APP_ENV[:=]\s*staging/);
    for (const dockerfile of dockerfiles)
      expect(dockerfile).toContain("ARG NEXT_PUBLIC_APP_ENV=local");
  });

  test("deploys only an immutable OCIR manifest digest", async () => {
    const source = await readFile(resolve("ops/oci/deploy-via-run-command.sh"), "utf8");

    expect(source).toContain("^sha256:[0-9a-f]{64}$");
    expect(source).toContain("instance-agent command create");
    expect(source).toContain("deploy-release.sh ${WEB_IMAGE_DIGEST} ${CONSOLE_IMAGE_DIGEST}");
    expect(source).not.toMatch(/:(?:latest|development)\b/);
  });

  test("waits for delayed Run Command execution materialization without a DevOps Shell stage", async () => {
    const source = await readFile(resolve("ops/oci/deploy-via-run-command.sh"), "utf8");

    expect(source).toContain("instance-agent command-execution get");
    expect(source).toContain("NotAuthorizedOrNotFound");
    expect(source).toContain("overall_deadline");
    expect(source).not.toContain("lookup_grace_deadline");
  });

  test("grants the deploy principal only the reads needed around Run Command", async () => {
    const iam = await readFile(resolve("infra/oci/iam.tf"), "utf8");

    expect(iam).toContain("to read instances in compartment id");
    expect(iam).toContain("to manage instance-agent-command-family in compartment id");
    expect(iam).toContain("to use instance-agent-command-execution-family in compartment id");
  });

  test("deploys the verified promotion artifact without rebuilding", async () => {
    const workflow = await readFile(resolve(".github/workflows/verify.yml"), "utf8");

    const deployment = await readFile(resolve(".github/workflows/deploy-promotion.yml"), "utf8");
    expect(workflow).toContain("promotion-candidate:");
    expect(deployment).toContain("actions/download-artifact@v4");
    expect(workflow).toContain("NEXT_PUBLIC_SENTRY_DSN: ${{ vars.NEXT_PUBLIC_SENTRY_DSN }}");
    expect(workflow).toContain(
      "required=(OCIR_REGISTRY OCIR_NAMESPACE OCIR_REPOSITORY OCIR_CONSOLE_REPOSITORY NEXT_PUBLIC_SENTRY_DSN SENTRY_ORG SENTRY_PROJECT SENTRY_AUTH_TOKEN)",
    );
    expect(workflow).toContain("NEXT_PUBLIC_SENTRY_DSN=${{ env.NEXT_PUBLIC_SENTRY_DSN }}");
    expect(deployment).toContain("deploy:\n    name: deploy");
    expect(deployment).not.toContain("docker/build-push-action");
    expect(deployment).toContain("oracle-actions/run-oci-cli-command@v1.3.2");
    expect(deployment).toContain(
      'bash ops/oci/deploy-via-run-command.sh "${WEB_IMAGE_DIGEST}" "${CONSOLE_IMAGE_DIGEST}"',
    );
  });

  test("configures shared Sentry source maps with commit correlation and a BuildKit secret", async () => {
    const [workflow, ...dockerfiles] = await Promise.all([
      readFile(resolve(".github/workflows/verify.yml"), "utf8"),
      readFile(resolve("apps/web/Dockerfile"), "utf8"),
      readFile(resolve("apps/console/Dockerfile"), "utf8"),
    ]);

    expect(workflow).toContain("SENTRY_ORG: ${{ vars.SENTRY_ORG }}");
    expect(workflow).toContain("SENTRY_PROJECT: ${{ vars.SENTRY_PROJECT }}");
    expect(workflow).toContain("SENTRY_RELEASE=oioi-bwg@${{ steps.source.outputs.source_sha }}");
    expect(workflow).toContain("SENTRY_AUTH_TOKEN=${{ secrets.SENTRY_AUTH_TOKEN }}");
    for (const dockerfile of dockerfiles) {
      expect(dockerfile).toContain("RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN");
      expect(dockerfile).toContain("apt-get install -y --no-install-recommends ca-certificates");
      expect(dockerfile).not.toContain("ARG SENTRY_AUTH_TOKEN");
      expect(dockerfile).not.toMatch(/^ENV .*SENTRY_AUTH_TOKEN/m);
    }
    const options = createSentryBuildOptions({
      authToken: "test-token",
      org: "test-org",
      project: "test-project",
      release: `oioi-bwg@${"a".repeat(40)}`,
    });
    expect(options.sourcemaps.filesToDeleteAfterUpload).toEqual([".next/**/*.map"]);
    expect(options.routeManifestInjection).toBe(false);
    const uploadError = new Error("synthetic upload failure");
    expect(() => options.errorHandler(uploadError)).toThrow(uploadError);
  });

  test("redacts sensitive remote output and preserves deployment exit semantics", async () => {
    const source = await readFile(resolve("ops/oci/deploy-via-run-command.sh"), "utf8");

    expect(source).toContain("<redacted: inspect protected host logs>");
    expect(source).toContain("candidate failed; rollback succeeded");
    expect(source).toContain("candidate failed; rollback failed");
    expect(source).toContain('exit "${remote_exit_code}"');
  });
});
