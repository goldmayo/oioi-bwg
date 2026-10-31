import {
  operatorSongResolveInputSchema,
  operatorSongResolveResultSchema,
} from "@oioi-bwg/contracts/operator-waveform";
import { authorizeOperatorToken } from "@oioi-bwg/server/services/operator-auth-service";
import { resolveOperatorSongs } from "@oioi-bwg/server/services/operator-song-service";

import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { getOperatorToken, operatorNoStore } from "@/server/operator/boundary";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

export async function POST(request: Request) {
  const route = "/api/operator/songs/resolve";
  try {
    const { context } = await authorizeOperatorToken(getOperatorToken(request));
    const input = operatorSongResolveInputSchema.parse(await readBoundedJsonBody(request, 16384));
    return operatorNoStore(
      jsonResponse(
        operatorSongResolveResultSchema,
        await resolveOperatorSongs(context, input.videoIds),
      ),
    );
  } catch (error) {
    return operatorNoStore(
      toErrorResponse(error, { route, ...readRequestObservation(request.headers, route) }),
      error,
    );
  }
}
