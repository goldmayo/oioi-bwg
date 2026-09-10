import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

describe("OCI DevOps Run Command specification", () => {
  test("uses the supported command artifact mode and exposes the digest through command spec env", async () => {
    const devops = await readFile(resolve("infra/oci/devops.tf"), "utf8");
    const commandSpec = await readFile(resolve("infra/oci/command-spec.yaml.tftpl"), "utf8");

    expect(devops).toContain('deploy_artifact_type       = "COMMAND_SPEC"');
    expect(devops).toContain('argument_substitution_mode = "NONE"');
    expect(devops).not.toContain('argument_substitution_mode = "SUBSTITUTE_PLACEHOLDERS"');
    expect(commandSpec).toContain('env:\n  variables:\n    IMAGE_DIGEST: "$${IMAGE_DIGEST}"');
    expect(commandSpec).toContain('image_digest="$${IMAGE_DIGEST}"');
  });

  test("keeps the repository private and the deployment identity digest-only", async () => {
    const repository = await readFile(resolve("infra/oci/ocir.tf"), "utf8");
    const commandSpec = await readFile(resolve("infra/oci/command-spec.yaml.tftpl"), "utf8");

    expect(repository).toContain("is_public      = false");
    expect(repository).not.toContain("is_immutable");
    expect(commandSpec).toContain("^sha256:[0-9a-f]{64}$");
    expect(commandSpec).toContain("deploy-release.sh $${image_digest}");
    expect(commandSpec).not.toMatch(/:(?:latest|development)\b/);
  });

  test("reports the execution output and preserves deployment exit semantics", async () => {
    const source = await readFile(resolve("infra/oci/command-spec.yaml.tftpl"), "utf8");

    expect(source).toContain("instance-agent command-execution get");
    expect(source).toContain("Remote exit code:");
    expect(source).toContain("Remote output:");
    expect(source).toContain("candidate failed; rollback succeeded");
    expect(source).toContain("candidate failed; rollback failed");
    expect(source).toContain('exit "$${remote_exit_code}"');
  });

  test("publishes rollback failure through the existing alert topic without printing secrets", async () => {
    const source = await readFile(resolve("infra/oci/command-spec.yaml.tftpl"), "utf8");

    expect(source).toContain("oci ons message publish");
    expect(source).toContain("${alert_topic_id}");
    expect(source).toContain("<redacted: remote output contained a sensitive marker>");
    expect(source).not.toContain("backup_failure");
  });
});
