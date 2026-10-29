// Real provider schema/planning with synthetic inputs and Docker --network=none.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, basename } from "node:path";

const source = resolve("infra/oci");
const directory = mkdtempSync(join(tmpdir(), "p08-queue-plan-"));
const image = "hashicorp/terraform:1.5.7";
const runnerSecret = "ocid1.vaultsecret.oc1.ap-osaka-1.fixture-runner";
const queueId = "ocid1.queue.oc1.ap-osaka-1.fixture";
const vars = {
  region: "ap-osaka-1",
  tenancy_ocid: "ocid1.tenancy.oc1..fixture",
  compartment_ocid: "ocid1.compartment.oc1..fixture",
  compute_compartment_ocid: "ocid1.compartment.oc1..compute",
  secret_compartment_ocid: "ocid1.compartment.oc1..secrets",
  compute_instance_ocid: "ocid1.instance.oc1.ap-osaka-1.fixture",
  backup_bucket_name: "fixture",
  console_auth_secret_ocid: "ocid1.vaultsecret.oc1.ap-osaka-1.fixture-auth",
  console_mfa_secret_ocid: "ocid1.vaultsecret.oc1.ap-osaka-1.fixture-mfa",
  runtime_secret_ocids: ["ocid1.vaultsecret.oc1.ap-osaka-1.fixture-web"],
};
function terraform(args, expectedFailure) {
  const name = `${basename(directory)}-check`;
  let result;
  try {
    result = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "--name",
        name,
        "--network=none",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--tmpfs",
        "/tmp:rw,nosuid,size=64m",
        "--pids-limit=64",
        "--memory=1g",
        "--memory-swap=1g",
        "--cpus=1",
        "--user",
        `${process.getuid()}:${process.getgid()}`,
        "-v",
        `${directory}:/work`,
        "-e",
        "TF_IN_AUTOMATION=1",
        "-e",
        "TF_INPUT=0",
        image,
        "-chdir=/work",
        ...args,
      ],
      { encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024 },
    );
  } finally {
    spawnSync("docker", ["rm", "--force", name], { stdio: "ignore", timeout: 10000 });
  }
  if (result.error) throw result.error;
  if (expectedFailure) {
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, expectedFailure);
  } else assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function plan(extra = {}, expectedFailure) {
  writeFileSync(join(directory, "fixture.auto.tfvars.json"), JSON.stringify({ ...vars, ...extra }));
  terraform(
    ["plan", "-refresh=false", "-input=false", "-no-color", "-out=fixture.plan"],
    expectedFailure,
  );
  if (!expectedFailure) return JSON.parse(terraform(["show", "-json", "fixture.plan"]));
}
const changes = (result) =>
  (result.resource_changes ?? []).filter((r) => r.change.actions.join() !== "no-op");
try {
  for (const file of ["waveform.tf", "variables.tf", "versions.tf", ".terraform.lock.hcl"])
    cpSync(join(source, file), join(directory, file));
  mkdirSync(join(directory, ".terraform"));
  cpSync(join(source, ".terraform/providers"), join(directory, ".terraform/providers"), {
    recursive: true,
    dereference: true,
  });
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  writeFileSync(join(directory, "synthetic.pem"), privateKey, { mode: 0o600 });
  writeFileSync(
    join(directory, "provider_override.tf"),
    `
provider "oci" {
  auth = "APIKey"
  tenancy_ocid = "ocid1.tenancy.oc1..fixture"
  user_ocid = "ocid1.user.oc1..fixture"
  fingerprint = "00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00"
  private_key_path = "/work/synthetic.pem"
}
`,
  );
  writeFileSync(
    join(directory, "fixture.tf"),
    `
locals {
  compute_principal = "fixture_compute"
  console_secret_ocids = [var.console_auth_secret_ocid, var.console_mfa_secret_ocid]
}
`,
  );
  execFileSync("docker", ["pull", image], { stdio: "pipe" });
  // Keep real Logging blocks; replace only external dependency identities in this offline fixture.
  const logging = readFileSync(join(source, "logging.tf"), "utf8")
    .replaceAll("oci_identity_dynamic_group.compute.id", '"ocid1.dynamicgroup.oc1..fixture"')
    .replace("[oci_identity_policy.runtime_and_deployment]", "[]");
  const loggingPath = join(directory, "logging.tf");
  writeFileSync(loggingPath, logging);
  terraform(["validate", "-no-color"]);
  const ids = {
    oci_logging_log_group: "ocid1.loggroup.oc1.ap-osaka-1.fixture",
    oci_logging_log: "ocid1.log.oc1.ap-osaka-1.fixture",
    oci_logging_unified_agent_configuration:
      "ocid1.unifiedagentconfiguration.oc1.ap-osaka-1.fixture",
  };
  const bootstrap = changes(plan());
  assert.equal(bootstrap.length, 3);
  const loggingState = bootstrap.map((r) => {
    const attributes = structuredClone(r.change.after);
    attributes.id = ids[r.type];
    if (r.type === "oci_logging_log") attributes.log_group_id = ids.oci_logging_log_group;
    if (r.type === "oci_logging_unified_agent_configuration") {
      attributes.service_configuration[0].destination[0].log_object_id = ids.oci_logging_log;
      const parser = attributes.service_configuration[0].sources[0].parser[0];
      // Reproduce the observed API shape using synthetic identities, without production state.
      Object.assign(parser, {
        time_type: null,
        is_estimate_current_event: true,
        is_null_empty_string: false,
      });
      assert.equal(parser.time_format, "%Y-%m-%dT%H:%M:%S.%N%z");
      assert.equal(parser.field_time_key, "time");
      assert.equal(parser.is_keep_time_key, true);
      assert.equal(parser.parse_nested, false);
    }
    return {
      mode: "managed",
      type: r.type,
      name: "application",
      provider: 'provider["registry.terraform.io/oracle/oci"]',
      instances: [{ schema_version: 0, attributes, sensitive_attributes: [] }],
    };
  });
  writeFileSync(
    join(directory, "terraform.tfstate"),
    JSON.stringify({
      version: 4,
      terraform_version: "1.5.7",
      serial: 1,
      lineage: "6fc5ed79-0000-4000-8000-000000000001",
      outputs: {},
      resources: loggingState,
    }),
  );
  writeFileSync(
    loggingPath,
    logging.replace(
      'field_time_key = "time"',
      'field_time_key = "time"\n        time_type = "string"',
    ),
  );
  const recurring = changes(plan());
  assert.deepEqual(
    recurring.map((r) => [r.address, r.change.actions]),
    [["oci_logging_unified_agent_configuration.application", ["update"]]],
  );
  assert.equal(
    recurring[0].change.after.service_configuration[0].sources[0].parser[0].time_type,
    "string",
  );
  writeFileSync(loggingPath, logging);
  assert.equal(changes(plan()).length, 0);
  // The Go provider also flattens a missing enum to an empty string; cover that state shape.
  const emptyEnumState = JSON.parse(readFileSync(join(directory, "terraform.tfstate"), "utf8"));
  emptyEnumState.resources.find(
    (r) => r.type === "oci_logging_unified_agent_configuration",
  ).instances[0].attributes.service_configuration[0].sources[0].parser[0].time_type = "";
  writeFileSync(join(directory, "terraform.tfstate"), JSON.stringify(emptyEnumState));
  assert.equal(changes(plan()).length, 0);
  writeFileSync(
    loggingPath,
    logging.replace(
      'field_time_key = "time"',
      'field_time_key = "time"\n        time_type = "string"',
    ),
  );
  assert.deepEqual(
    changes(plan()).map((r) => [r.address, r.change.actions]),
    [["oci_logging_unified_agent_configuration.application", ["update"]]],
  );
  writeFileSync(loggingPath, logging);
  writeFileSync(loggingPath, logging.replace("%N%z", "%NZ"));
  assert.deepEqual(
    changes(plan()).map((r) => [r.address, r.change.actions]),
    [["oci_logging_unified_agent_configuration.application", ["update"]]],
  );
  writeFileSync(loggingPath, logging);
  const enabled = { waveform_queue_enabled: true, waveform_runner_secret_ocid: runnerSecret };
  const candidate = plan(enabled);
  assert.deepEqual(
    changes(candidate).map((r) => [r.address, r.change.actions]),
    [
      ["oci_identity_policy.waveform[0]", ["create"]],
      ["oci_queue_queue.waveform[0]", ["create"]],
    ],
  );
  const queue = candidate.resource_changes.find((r) => r.type === "oci_queue_queue").change.after;
  for (const [key, value] of Object.entries({
    retention_in_seconds: 86400,
    visibility_in_seconds: 180,
    timeout_in_seconds: 30,
    dead_letter_queue_delivery_count: 5,
  }))
    assert.equal(queue[key], value);
  assert.ok(!JSON.stringify(candidate).includes("PRIVATE KEY"));
  plan({ waveform_queue_enabled: true }, /dedicated Runner Secret/);
  for (const secret of [
    vars.console_auth_secret_ocid,
    vars.console_mfa_secret_ocid,
    vars.runtime_secret_ocids[0],
  ])
    plan({ ...enabled, waveform_runner_secret_ocid: secret }, /must not reuse/);
  plan(
    { ...enabled, waveform_runner_secret_ocid: "not-a-secret-ocid" },
    /dedicated Runner Vault Secret OCID/,
  );
  writeFileSync(
    join(directory, "terraform.tfstate"),
    JSON.stringify({
      version: 4,
      terraform_version: "1.5.7",
      serial: 1,
      lineage: "6fc5ed79-0000-4000-8000-000000000001",
      outputs: {},
      resources: [
        ...loggingState,
        {
          mode: "managed",
          type: "oci_queue_queue",
          name: "waveform",
          provider: 'provider["registry.terraform.io/oracle/oci"]',
          instances: [
            {
              index_key: 0,
              schema_version: 0,
              attributes: {
                ...queue,
                id: queueId,
                messages_endpoint: "https://fixture.invalid",
                state: "ACTIVE",
              },
              sensitive_attributes: [],
            },
          ],
        },
      ],
    }),
  );
  const existing = plan(enabled);
  const statements = existing.resource_changes.find((r) => r.type === "oci_identity_policy").change
    .after.statements;
  assert.deepEqual(statements, [
    `Allow dynamic-group fixture_compute to use queue-push in compartment id ${vars.compartment_ocid} where target.queue.id='${queueId}'`,
    `Allow dynamic-group fixture_compute to use queue-pull in compartment id ${vars.compartment_ocid} where target.queue.id='${queueId}'`,
    `Allow dynamic-group fixture_compute to read secret-bundles in compartment id ${vars.secret_compartment_ocid} where target.secret.id='${runnerSecret}'`,
  ]);
  plan({}, /cannot be destroyed/);
  const waveform = readFileSync(join(directory, "waveform.tf"), "utf8");
  writeFileSync(join(directory, "waveform.tf"), waveform.replace("= 86400", "= 86401"));
  plan(enabled, /cannot be destroyed/);
  console.log(
    "P08 offline provider Plan: Logging drift reproduction/fix and real drift detection, disabled, Queue/IAM-only create, settings, IAM, invalid Secret and destroy/replace guards passed; no OCI calls.",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
