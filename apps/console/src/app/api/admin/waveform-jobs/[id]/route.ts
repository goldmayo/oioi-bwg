import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { waveformJobSchema } from "@oioi-bwg/contracts/waveform";
import { getWaveformJob } from "@oioi-bwg/server/services/waveform-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";

import { readRequestObservation } from "@/shared/lib/observability-correlation";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let authorization: RequestAuthorization | undefined;
  try {
    authorization = await getRequestAuthorization();
    return jsonResponse(
      waveformJobSchema,
      await getWaveformJob(authorization.context, entityIdSchema.parse((await context.params).id)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error, {
      route: "/api/admin/waveform-jobs/[id]",
      ...readRequestObservation(request.headers, "/api/admin/waveform-jobs/[id]"),
      authorization,
    });
  }
}
