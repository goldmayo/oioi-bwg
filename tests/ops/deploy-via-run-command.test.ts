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

  test("waits for Run Command directly without a DevOps Shell stage", async () => {
    const source = await readFile(resolve("ops/oci/deploy-via-run-command.sh"), "utf8");

    expect(source).toContain("instance-agent command-execution get");
    expect(source).toContain("lookup_grace_deadline");
    expect(source).toContain("overall_deadline");
  });

  test("deploys automatically after verified migration_develop image publish", async () => {
    const workflow = await readFile(resolve(".github/workflows/verify.yml"), "utf8");

    expect(workflow).toContain("publish-image:");
    expect(workflow).toContain("image_digest: ${{ steps.release.outputs.digest }}");
    expect(workflow).toContain("deploy:\n    name: deploy");
    expect(workflow).toContain("needs: publish-image");
    expect(workflow).toContain("oracle-actions/run-oci-cli-command@v1.3.2");
    expect(workflow).toContain('bash ops/oci/deploy-via-run-command.sh "${IMAGE_DIGEST}"');
  });

  test("redacts sensitive remote output and preserves deployment exit semantics", async () => {
    const source = await readFile(resolve("ops/oci/deploy-via-run-command.sh"), "utf8");

    expect(source).toContain("<redacted: remote output contained a sensitive marker>");
    expect(source).toContain("candidate failed; rollback succeeded");
    expect(source).toContain("candidate failed; rollback failed");
    expect(source).toContain('exit "${remote_exit_code}"');
  });
});
