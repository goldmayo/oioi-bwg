import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { waveformDataSchema, waveformJobSchema } from "@oioi-bwg/contracts/waveform";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { getSongWaveform, importSongWaveform } from "@oioi-bwg/server/services/waveform-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { requireUser } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { assertConsoleOrigin } from "@/server/http/console-origin";
import { wakeNotificationDispatcher } from "@/server/notifications/dispatcher";

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

/** 파일 자체는 저장하지 않고 인증 후 제한된 JSON 본문만 읽는다. */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  let authorization: RequestAuthorization | undefined;
  const route = "/api/admin/songs/[id]/waveform";
  let response: Response;
  try {
    authorization = await getRequestAuthorization();
    requireUser(authorization.context);
    if (authorization.context.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
    assertConsoleOrigin(request.headers);
    const id = entityIdSchema.parse((await context.params).id);
    const input = waveformDataSchema.parse(await readBoundedJsonBody(request));
    const job = await importSongWaveform(authorization.context, id, input);
    wakeNotificationDispatcher();
    response = jsonResponse(waveformJobSchema, job);
  } catch (error) {
    response = toErrorResponse(error, {
      route,
      ...readRequestObservation(request.headers, route),
      authorization,
    });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
