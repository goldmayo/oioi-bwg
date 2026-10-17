import {
  chmodSync,
  linkSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, expect, test } from "vitest";

import {
  parseOperatorArguments,
  readOperatorConfiguration,
  verifyOperatorReason,
} from "../../scripts/console-mfa-operator-policy";

const directory = mkdtempSync(path.join(tmpdir(), "p05b3-policy-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const args = [
  "mfa-reset",
  "--config",
  "operator.json",
  "--account-id",
  "1",
  "--expected-version",
  "none",
  "--reason-file",
  "reason.txt",
  "--apply",
];
const configuration = {
  scope: "local-compose",
  operatorUid: process.getuid!(),
  databaseUrl: "postgresql://oioi_app:fixture-only@127.0.0.1:5432/oioibawige",
  serverStartedAt: "1234567890.000000",
};

test("operator requires explicit target, expected values, apply, and a nonempty reason", () => {
  expect(parseOperatorArguments(args)).toMatchObject({
    command: "mfa-reset",
    accountId: 1n,
    version: null,
  });
  for (const input of [
    args.slice(0, -1),
    [...args, "--apply"],
    [...args, "--allow-production"],
    args.map((v) => (v === "1" ? "0" : v)),
    args.map((v) => (v === "none" ? "2147483648" : v)),
  ]) {
    expect(() => parseOperatorArguments(input)).toThrow("INVALID_REQUEST");
  }
  const reasonFile = path.join(directory, "reason.txt");
  for (const reason of [" ", "가".repeat(201)]) {
    writeFileSync(reasonFile, reason, { mode: 0o600 });
    expect(() => verifyOperatorReason(reasonFile)).toThrow("INVALID_REQUEST");
  }
  writeFileSync(reasonFile, "승인된 변경");
  expect(() => verifyOperatorReason(reasonFile)).not.toThrow();
  const access = [
    "account-access",
    ...args.slice(1),
    "--expected-role",
    "ADMIN",
    "--expected-status",
    "ACTIVE",
    "--role",
    "USER",
    "--status",
    "SUSPENDED",
  ];
  expect(parseOperatorArguments(access)).toMatchObject({
    expected: { role: "ADMIN" },
    next: { status: "SUSPENDED" },
  });
  expect(() =>
    parseOperatorArguments(access.map((v) => (v === "SUSPENDED" ? "DELETED" : v))),
  ).toThrow("INVALID_REQUEST");
});

test("operator requires an owner-only single-link file and matching operator UID", () => {
  const file = path.join(directory, "operator.json");
  writeFileSync(file, JSON.stringify(configuration), { mode: 0o600 });
  expect(readOperatorConfiguration(file).role).toBe("oioi_app");
  chmodSync(file, 0o644);
  expect(() => readOperatorConfiguration(file)).toThrow("OPERATOR_CONFIG_REJECTED");
  chmodSync(file, 0o600);
  const hardlink = path.join(directory, "hardlink.json");
  linkSync(file, hardlink);
  expect(() => readOperatorConfiguration(file)).toThrow("OPERATOR_CONFIG_REJECTED");
  unlinkSync(hardlink);
  symlinkSync(file, path.join(directory, "link.json"));
  expect(() => readOperatorConfiguration(path.join(directory, "link.json"))).toThrow(
    "OPERATOR_CONFIG_REJECTED",
  );
  writeFileSync(
    file,
    JSON.stringify({ ...configuration, operatorUid: configuration.operatorUid + 1 }),
  );
  expect(() => readOperatorConfiguration(file)).toThrow("OPERATOR_CONFIG_REJECTED");
});

test("operator rejects remote URLs, alternate ports/roles/DBs and env shortcuts", () => {
  const file = path.join(directory, "target.json");
  for (const url of [
    "postgresql://oioi_app:credential@remote.example/oioibawige",
    "postgresql://oioi_app:credential@127.0.0.1:15432/oioibawige",
    "postgresql://oioibawige:credential@127.0.0.1/oioibawige",
    "postgresql://oioi_app:credential@127.0.0.1/postgres",
    `${configuration.databaseUrl}?host=remote.example`,
  ]) {
    writeFileSync(file, JSON.stringify({ ...configuration, databaseUrl: url }), { mode: 0o600 });
    expect(() => readOperatorConfiguration(file)).toThrow("OPERATOR_CONFIG_REJECTED");
  }
});
