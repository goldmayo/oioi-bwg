import { executeOperatorRequest, operatorFailure } from "./console-mfa-execution";
import {
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
  return executeOperatorRequest(request, config);
}

main()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error: unknown) => {
    console.error(JSON.stringify({ ...target, success: false, code: operatorFailure(error) }));
    process.exitCode = 1;
  });
