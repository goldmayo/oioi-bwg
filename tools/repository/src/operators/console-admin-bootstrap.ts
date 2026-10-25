import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";

import { getDatabase } from "@oioi-bwg/server/db";
import { bootstrapConsoleAdminCredential } from "@oioi-bwg/server/services/console-admin-bootstrap-service";

import { operatorFailure, verifyOperatorDatabaseTarget } from "./console-mfa-execution";
import {
  parseOperatorArguments,
  readOperatorConfiguration,
  verifyOperatorReason,
} from "./console-mfa-operator-policy";

async function hiddenLine(prompt: string) {
  if (!process.stdin.isTTY) throw new Error("TTY_REQUIRED");
  const muted = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const input = createInterface({ input: process.stdin, output: muted, terminal: true });
  const controller = new AbortController();
  input.once("SIGINT", () => controller.abort());
  process.stderr.write(prompt);
  try {
    return await input.question("", { signal: controller.signal });
  } finally {
    input.close();
    process.stderr.write("\n");
  }
}

async function main() {
  const request = parseOperatorArguments(["mfa-reset", ...process.argv.slice(2)]);
  const config = readOperatorConfiguration(request.config);
  verifyOperatorReason(request.reasonFile);
  if (!process.stdin.isTTY) throw new Error("TTY_REQUIRED");
  process.env.DATABASE_URL = config.databaseUrl;
  const database = getDatabase();
  try {
    await verifyOperatorDatabaseTarget(database, config);
    const email = await hiddenLine("Console email (hidden): ");
    const password = await hiddenLine("New Console password (hidden): ");
    if (password !== (await hiddenLine("Confirm password (hidden): "))) throw new Error("MISMATCH");
    const result = await bootstrapConsoleAdminCredential(
      request.accountId,
      request.version,
      email,
      password,
    );
    return { success: true, ...result };
  } finally {
    await database.$client.end();
  }
}

main()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error: unknown) => {
    console.error(JSON.stringify({ success: false, code: operatorFailure(error) }));
    process.exitCode = 1;
  });
