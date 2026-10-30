import { operatorRevokeResultSchema } from "@oioi-bwg/contracts/operator-auth";
import {
  authorizeOperatorToken,
  revokeOperatorToken,
} from "@oioi-bwg/server/services/operator-auth-service";
import { z } from "zod";

import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { getOperatorToken, operatorNoStore } from "@/server/operator/boundary";

import { readRequestObservation } from "@/shared/lib/observability-correlation";
export async function POST(request: Request) {
  try {
    const token = getOperatorToken(request);
    await authorizeOperatorToken(token);
    z.strictObject({}).parse(await readBoundedJsonBody(request, 1024));
    return operatorNoStore(
      jsonResponse(operatorRevokeResultSchema, await revokeOperatorToken(token)),
    );
  } catch (error) {
    return operatorNoStore(
      toErrorResponse(error, {
        route: "/api/operator/auth/revoke",
        ...readRequestObservation(request.headers, "/api/operator/auth/revoke"),
      }),
      error,
    );
  }
}
