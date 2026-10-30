import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { waveformDataSchema, waveformJobSchema } from "@oioi-bwg/contracts/waveform";
import { authorizeOperatorToken } from "@oioi-bwg/server/services/operator-auth-service";
import { getSongWaveform, importSongWaveform } from "@oioi-bwg/server/services/waveform-service";

import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { wakeNotificationDispatcher } from "@/server/notifications/dispatcher";
import { getOperatorToken, operatorNoStore } from "@/server/operator/boundary";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

const route = "/api/operator/songs/[id]/waveform";
export async function GET(request: Request, params: { params: Promise<{ id: string }> }) {
  try {
    const { context } = await authorizeOperatorToken(getOperatorToken(request));
    const id = entityIdSchema.parse((await params.params).id);
    return operatorNoStore(
      jsonResponse(waveformDataSchema.nullable(), await getSongWaveform(context, id)),
    );
  } catch (error) {
    return operatorNoStore(
      toErrorResponse(error, { route, ...readRequestObservation(request.headers, route) }),
      error,
    );
  }
}
export async function PUT(request: Request, params: { params: Promise<{ id: string }> }) {
  try {
    const { context } = await authorizeOperatorToken(getOperatorToken(request));
    const id = entityIdSchema.parse((await params.params).id);
    const input = waveformDataSchema.parse(await readBoundedJsonBody(request));
    const job = await importSongWaveform(context, id, input);
    wakeNotificationDispatcher();
    return operatorNoStore(jsonResponse(waveformJobSchema, job));
  } catch (error) {
    return operatorNoStore(
      toErrorResponse(error, { route, ...readRequestObservation(request.headers, route) }),
      error,
    );
  }
}
