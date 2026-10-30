import {
  operatorExchangeInputSchema,
  operatorExchangeResultSchema,
} from "@oioi-bwg/contracts/operator-auth";
import { exchangeOperatorGrant } from "@oioi-bwg/server/services/operator-auth-service";

import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import {
  assertOperatorCliRequest,
  operatorClientIp,
  operatorNoStore,
  takeOperatorQuota,
} from "@/server/operator/boundary";

import { readRequestObservation } from "@/shared/lib/observability-correlation";
export async function POST(request: Request) {
  try {
    assertOperatorCliRequest(request);
    takeOperatorQuota("pollIp", operatorClientIp(request));
    const input = operatorExchangeInputSchema.parse(await readBoundedJsonBody(request, 1024));
    takeOperatorQuota("pollDevice", input.deviceCode);
    return operatorNoStore(
      jsonResponse(operatorExchangeResultSchema, await exchangeOperatorGrant(input.deviceCode)),
    );
  } catch (error) {
    return operatorNoStore(
      toErrorResponse(error, {
        route: "/api/operator/auth/token",
        ...readRequestObservation(request.headers, "/api/operator/auth/token"),
      }),
      error,
    );
  }
}
