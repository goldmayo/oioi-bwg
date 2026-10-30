import { operatorIdentitySchema } from "@oioi-bwg/contracts/operator-auth";
import { authorizeOperatorToken } from "@oioi-bwg/server/services/operator-auth-service";

import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { getOperatorToken, operatorNoStore } from "@/server/operator/boundary";

import { readRequestObservation } from "@/shared/lib/observability-correlation";
export async function GET(request: Request) {
  try {
    const { accountId, expiresAt } = await authorizeOperatorToken(getOperatorToken(request));
    return operatorNoStore(jsonResponse(operatorIdentitySchema, { accountId, expiresAt }));
  } catch (error) {
    return operatorNoStore(
      toErrorResponse(error, {
        route: "/api/operator/auth/session",
        ...readRequestObservation(request.headers, "/api/operator/auth/session"),
      }),
      error,
    );
  }
}
