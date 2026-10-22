import {
  adminSongIdParamsSchema,
  adminSongMutationResultSchema,
  saveAdminSongLyricsSchema,
} from "@oioi-bwg/contracts/song";
import { saveSongLyrics } from "@oioi-bwg/server/services/song-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

interface SongLyricsRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: SongLyricsRouteContext) {
  let authorization: RequestAuthorization | undefined;
  try {
    const { id } = adminSongIdParamsSchema.parse(await context.params);
    const input = await parseJsonRequest(request, saveAdminSongLyricsSchema);
    const song = await saveSongLyrics(
      (authorization = await getRequestAuthorization()).context,
      id,
      input,
    );
    return jsonResponse(adminSongMutationResultSchema, song);
  } catch (error) {
    return toErrorResponse(error, {
      route: "/api/admin/songs/[id]/lyrics",
      ...readRequestObservation(request.headers, "/api/admin/songs/[id]/lyrics"),
      authorization,
    });
  }
}
