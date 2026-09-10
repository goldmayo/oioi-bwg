import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

describe("OCI DevOps Run Command specification", () => {
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
