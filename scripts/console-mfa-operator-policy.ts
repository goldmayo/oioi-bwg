import { constants, openSync, fstatSync, readFileSync, closeSync } from "node:fs";

import { ACCOUNT_ROLES, type AccountRole } from "@oioi-bwg/server/db/schema";

export class OperatorError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
type Access = { role: AccountRole; status: "ACTIVE" | "SUSPENDED" };

export function parseOperatorArguments(args: string[]) {
  const [command, ...rest] = args;
  const fields = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 1) {
    const name = rest[i]!;
    const value = name === "--apply" ? "true" : rest[++i];
    if (!name.startsWith("--") || !value || value.startsWith("--") || fields.has(name))
      throw new OperatorError("INVALID_REQUEST");
    fields.set(name, value);
  }
  const common = ["--config", "--account-id", "--expected-version", "--reason-file", "--apply"];
  const access = ["--expected-role", "--expected-status", "--role", "--status"];
  const required = command === "account-access" ? [...common, ...access] : common;
  if (
    !new Set(["mfa-reset", "account-access"]).has(command ?? "") ||
    required.some((name) => !fields.has(name)) ||
    fields.size !== required.length
  )
    throw new OperatorError("INVALID_REQUEST");
  const id = fields.get("--account-id")!;
  const version = fields.get("--expected-version")!;
  if (
    !/^[1-9]\d{0,18}$/.test(id) ||
    BigInt(id) > 9_223_372_036_854_775_807n ||
    (version !== "none" && (!/^[1-9]\d{0,9}$/.test(version) || Number(version) > 2_147_483_647))
  )
    throw new OperatorError("INVALID_REQUEST");
  const base = {
    config: fields.get("--config")!,
    reasonFile: fields.get("--reason-file")!,
    accountId: BigInt(id),
    version: version === "none" ? null : Number(version),
  };
  const readAccess = (prefix: string): Access => {
    const role = fields.get(`--${prefix}role`)!;
    const status = fields.get(`--${prefix}status`)!;
    if (
      !(ACCOUNT_ROLES as readonly string[]).includes(role) ||
      (status !== "ACTIVE" && status !== "SUSPENDED")
    )
      throw new OperatorError("INVALID_REQUEST");
    return { role: role as AccountRole, status };
  };
  return command === "account-access"
    ? {
        ...base,
        command: "account-access" as const,
        expected: readAccess("expected-"),
        next: readAccess(""),
      }
    : { ...base, command: "mfa-reset" as const };
}

function readProtectedOperatorFile(file: string) {
  let fd: number | undefined;
  try {
    if (!process.getuid) throw new Error();
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid() ||
      (stat.mode & 0o7777) !== 0o600 ||
      stat.nlink !== 1 ||
      stat.size > 8192
    )
      throw new Error();
    return readFileSync(fd, "utf8");
  } catch {
    throw new OperatorError("OPERATOR_CONFIG_REJECTED");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function verifyOperatorReason(file: string) {
  const reason = readProtectedOperatorFile(file).trim();
  if (!reason || reason.length > 200) throw new OperatorError("INVALID_REQUEST");
}

export function readOperatorConfiguration(file: string) {
  try {
    const config: unknown = JSON.parse(readProtectedOperatorFile(file));
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error();
    const data = config as Record<string, unknown>;
    if (
      Object.keys(data).sort().join() !== "databaseUrl,operatorUid,scope,serverStartedAt" ||
      data.scope !== "local-compose" ||
      data.operatorUid !== process.getuid() ||
      typeof data.databaseUrl !== "string" ||
      typeof data.serverStartedAt !== "string" ||
      !/^\d+\.\d{6}$/.test(data.serverStartedAt)
    )
      throw new Error();
    const url = new URL(data.databaseUrl);
    const name = url.pathname.slice(1);
    const role =
      name === "oioibawige"
        ? "oioi_app"
        : `m9_app_${name.slice("oioi_m7_test_".length).slice(-24)}`;
    if (
      !new Set(["postgres:", "postgresql:"]).has(url.protocol) ||
      url.hostname !== "127.0.0.1" ||
      (url.port && url.port !== "5432") ||
      url.search ||
      url.hash ||
      !url.password ||
      url.username !== role ||
      (name !== "oioibawige" && !/^oioi_m7_test_[a-z0-9_]+$/.test(name))
    )
      throw new Error();
    return { databaseUrl: url.toString(), name, role, serverStartedAt: data.serverStartedAt };
  } catch {
    throw new OperatorError("OPERATOR_CONFIG_REJECTED");
  }
}
