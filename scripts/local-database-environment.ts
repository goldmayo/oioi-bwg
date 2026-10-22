import { readFileSync } from "node:fs";

import dotenv from "dotenv";

const localHosts = new Set(["localhost", "127.0.0.1", "postgres"]);

export function assertLocalDatabaseUrl(value: string | undefined): string {
  if (!value) throw new Error("DATABASE_URL is required; set it or select --env-file.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid local PostgreSQL URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !localHosts.has(url.hostname) ||
    url.href.includes("?") ||
    url.href.includes("#")
  ) {
    throw new Error("DATABASE_URL must use a local PostgreSQL host without query or fragment.");
  }
  return url.href;
}

/** 한 DB 입력만 선택하며 앱 env 전체를 process나 child에 복사하지 않는다. */
export function loadLocalDatabaseUrl(args: readonly string[], environment = process.env): string {
  let envFile: string | undefined;
  if (args.length === 2 && args[0] === "--env-file" && args[1]) envFile = args[1];
  else if (args.length === 1 && args[0]?.startsWith("--env-file=")) {
    envFile = args[0].slice("--env-file=".length);
  } else if (args.length) throw new Error("Only --env-file <path> is accepted for DB tools.");
  if (args.length && !envFile) throw new Error("--env-file requires a path.");

  let fileUrl: string | undefined;
  if (envFile) {
    try {
      fileUrl = dotenv.parse(readFileSync(envFile)).DATABASE_URL;
    } catch {
      throw new Error("Could not read the selected DB env file.");
    }
    if (!fileUrl) throw new Error("The selected DB env file must define DATABASE_URL.");
    if (environment.DATABASE_URL !== undefined && environment.DATABASE_URL !== fileUrl) {
      throw new Error("DATABASE_URL conflicts with the selected env file.");
    }
  }
  return assertLocalDatabaseUrl(fileUrl ?? environment.DATABASE_URL);
}
