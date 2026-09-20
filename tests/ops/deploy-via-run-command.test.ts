import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

describe("GitHub Actions OCI Run Command deployment", () => {
  test("deploys only an immutable OCIR manifest digest", async () => {
    const source = await readFile(resolve("ops/oci/deploy-via-run-command.sh"), "utf8");

    expect(source).toContain("^sha256:[0-9a-f]{64}$");
    expect(source).toContain("instance-agent command create");
    expect(source).toContain("deploy-release.sh ${IMAGE_DIGEST}");
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

  test("deploys automatically after verified migration_develop image publish", async () => {
    const workflow = await readFile(resolve(".github/workflows/verify.yml"), "utf8");

    expect(workflow).toContain("publish-image:");
    expect(workflow).toContain("image_digest: ${{ steps.release.outputs.digest }}");
    expect(workflow).toContain("NEXT_PUBLIC_SENTRY_DSN: ${{ vars.NEXT_PUBLIC_SENTRY_DSN }}");
    expect(workflow).toContain(
      "required=(OCIR_REGISTRY OCIR_NAMESPACE OCIR_REPOSITORY NEXT_PUBLIC_SENTRY_DSN SENTRY_ORG SENTRY_PROJECT SENTRY_AUTH_TOKEN)",
    );
    expect(workflow).toContain("NEXT_PUBLIC_SENTRY_DSN=${{ env.NEXT_PUBLIC_SENTRY_DSN }}");
    expect(workflow).toContain("deploy:\n    name: deploy");
    expect(workflow).toContain("needs: publish-image");
    expect(workflow).toContain("oracle-actions/run-oci-cli-command@v1.3.2");
    expect(workflow).toContain('bash ops/oci/deploy-via-run-command.sh "${IMAGE_DIGEST}"');
  });

  test("uploads Sentry source maps with commit correlation and a BuildKit secret", async () => {
    const [workflow, dockerfile, nextConfig] = await Promise.all([
      readFile(resolve(".github/workflows/verify.yml"), "utf8"),
      readFile(resolve("Dockerfile"), "utf8"),
      readFile(resolve("next.config.ts"), "utf8"),
    ]);

    expect(workflow).toContain("SENTRY_ORG: ${{ vars.SENTRY_ORG }}");
    expect(workflow).toContain("SENTRY_PROJECT: ${{ vars.SENTRY_PROJECT }}");
    expect(workflow).toContain("SENTRY_RELEASE=oioi-bwg@${{ github.sha }}");
    expect(workflow).toContain("SENTRY_AUTH_TOKEN=${{ secrets.SENTRY_AUTH_TOKEN }}");
    expect(dockerfile).toContain("RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN");
    expect(dockerfile).toContain("apt-get install -y --no-install-recommends ca-certificates");
    expect(dockerfile).not.toContain("ARG SENTRY_AUTH_TOKEN");
    expect(dockerfile).not.toMatch(/^ENV .*SENTRY_AUTH_TOKEN/m);
    expect(nextConfig).toContain('filesToDeleteAfterUpload: [".next/**/*.map"]');
    expect(nextConfig).toContain("routeManifestInjection: false");
    expect(nextConfig).toMatch(/errorHandler\(error\) \{\s*throw error;\s*\}/);
  });

  test("redacts sensitive remote output and preserves deployment exit semantics", async () => {
    const source = await readFile(resolve("ops/oci/deploy-via-run-command.sh"), "utf8");

    expect(source).toContain("<redacted: remote output contained a sensitive marker>");
    expect(source).toContain("candidate failed; rollback succeeded");
    expect(source).toContain("candidate failed; rollback failed");
    expect(source).toContain('exit "${remote_exit_code}"');
  });
});
