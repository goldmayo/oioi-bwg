import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { waveformDataSchema } from "@oioi-bwg/contracts/waveform";
import { getSongWaveform } from "@oioi-bwg/server/services/waveform-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let authorization: RequestAuthorization | undefined;
  const route = "/api/admin/songs/[id]/waveform";
  try {
    authorization = await getRequestAuthorization();
    const id = entityIdSchema.parse((await context.params).id);
    return jsonResponse(
      waveformDataSchema.nullable(),
      await getSongWaveform(authorization.context, id),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return toErrorResponse(error, {
      route,
      ...readRequestObservation(request.headers, route),
      authorization,
    });
  }
}
