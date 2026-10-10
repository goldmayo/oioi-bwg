import { getDatabase } from "@oioi-bwg/server/db";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import {
  changeConsoleAccountAccess,
  resetConsoleMfa,
} from "@oioi-bwg/server/services/console-mfa-revocation-service";

import {
  OperatorError,
  parseOperatorArguments,
  readOperatorConfiguration,
  verifyOperatorReason,
} from "./console-mfa-operator-policy";

let target: { command: string; accountId: string } | undefined;

async function main() {
  const request = parseOperatorArguments(process.argv.slice(2));
  target = { command: request.command, accountId: request.accountId.toString() };
  const config = readOperatorConfiguration(request.config);
  verifyOperatorReason(request.reasonFile);
  process.env.DATABASE_URL = config.databaseUrl;
  const database = getDatabase();
  try {
    const [identity] =
      await database.$client`select current_database() as name, current_user as role,
      extract(epoch from pg_catalog.pg_postmaster_start_time())::text as started,
      current_setting('server_version_num')::integer / 10000 as major,
      rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls as privileged,
      pg_catalog.pg_has_role(current_user, (select relowner from pg_class where oid='public.admin_mfa'::regclass), 'MEMBER') as owner
      from pg_roles where rolname=current_user`;
    if (
      !identity ||
      identity.name !== config.name ||
      identity.role !== config.role ||
      identity.started !== config.serverStartedAt ||
      identity.major !== 17 ||
      identity.privileged ||
      identity.owner
    )
      throw new OperatorError("DATABASE_TARGET_REJECTED");
    const result =
      request.command === "mfa-reset"
        ? await resetConsoleMfa(request.accountId, request.version)
        : await changeConsoleAccountAccess(
            request.accountId,
            { ...request.expected, version: request.version },
            request.next,
          );
    return {
      success: true,
      command: request.command,
      ...result,
      ...(request.command === "account-access"
        ? { previousRole: request.expected.role, previousStatus: request.expected.status }
        : {}),
    };
  } finally {
    await database.$client.end();
  }
}

main()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error: unknown) => {
    const code =
      error instanceof OperatorError
        ? error.code
        : error instanceof AppError && error.code === "FORBIDDEN"
          ? "STATE_CHANGED"
          : "OPERATION_FAILED";
    console.error(JSON.stringify({ ...target, success: false, code }));
    process.exitCode = 1;
  });
