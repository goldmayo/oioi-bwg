import {
  adminSongIdParamsSchema,
  adminSongMutationResultSchema,
  updateAdminSongSchema,
} from "@oioi-bwg/contracts/song";
import { deleteSong, editSong } from "@oioi-bwg/server/services/song-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";
import { assertConsoleOrigin } from "@/server/http/console-origin";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

interface SongRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: SongRouteContext) {
  let authorization: RequestAuthorization | undefined;
  try {
    const { id } = adminSongIdParamsSchema.parse(await context.params);
    const input = await parseJsonRequest(request, updateAdminSongSchema);
    const song = await editSong(
      (authorization = await getRequestAuthorization()).context,
      id,
      input,
    );
    return jsonResponse(adminSongMutationResultSchema, song);
  } catch (error) {
    return toErrorResponse(error, {
      route: "/api/admin/songs/[id]",
      ...readRequestObservation(request.headers, "/api/admin/songs/[id]"),
      authorization,
    });
  }
}

export async function DELETE(request: Request, context: SongRouteContext) {
  let authorization: RequestAuthorization | undefined;
  try {
    assertConsoleOrigin(request.headers);
    const { id } = adminSongIdParamsSchema.parse(await context.params);
    await deleteSong((authorization = await getRequestAuthorization()).context, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error, {
      route: "/api/admin/songs/[id]",
      ...readRequestObservation(request.headers, "/api/admin/songs/[id]"),
      authorization,
    });
  }
}
