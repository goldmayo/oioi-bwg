import {
  operatorApprovalInputSchema,
  operatorApprovalResultSchema,
} from "@oioi-bwg/contracts/operator-auth";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { approveOperatorGrant } from "@oioi-bwg/server/services/operator-auth-service";

import { getRequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { assertConsoleOrigin } from "@/server/http/console-origin";
import {
  assertOperatorEnabled,
  operatorNoStore,
  takeOperatorQuota,
} from "@/server/operator/boundary";

import { readRequestObservation } from "@/shared/lib/observability-correlation";
export async function POST(request: Request) {
  try {
    assertOperatorEnabled();
    const auth = await getRequestAuthorization();
    if (!auth.context.user || !auth.mfaVersion) throw new AppError("UNAUTHENTICATED");
    if (auth.context.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
    assertConsoleOrigin(request.headers);
    takeOperatorQuota("approve", auth.context.user.id);
    const input = operatorApprovalInputSchema.parse(await readBoundedJsonBody(request, 1024));
    return operatorNoStore(
      jsonResponse(
        operatorApprovalResultSchema,
        await approveOperatorGrant(auth.context, auth.mfaVersion, input.userCode),
      ),
    );
  } catch (error) {
    return operatorNoStore(
      toErrorResponse(error, {
        route: "/api/operator/auth/approve",
        ...readRequestObservation(request.headers, "/api/operator/auth/approve"),
      }),
      error,
    );
  }
}
