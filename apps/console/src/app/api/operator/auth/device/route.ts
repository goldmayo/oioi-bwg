import { operatorDeviceGrantSchema } from "@oioi-bwg/contracts/operator-auth";
import { createOperatorGrant } from "@oioi-bwg/server/services/operator-auth-service";
import { z } from "zod";

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
    takeOperatorQuota("create", operatorClientIp(request));
    z.strictObject({}).parse(await readBoundedJsonBody(request, 1024));
    return operatorNoStore(jsonResponse(operatorDeviceGrantSchema, await createOperatorGrant()));
  } catch (error) {
    return operatorNoStore(
      toErrorResponse(error, {
        route: "/api/operator/auth/device",
        ...readRequestObservation(request.headers, "/api/operator/auth/device"),
      }),
      error,
    );
  }
}
