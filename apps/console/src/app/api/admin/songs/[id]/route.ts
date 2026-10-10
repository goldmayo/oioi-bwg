import {
  adminSongIdParamsSchema,
  adminSongMutationResultSchema,
  updateAdminSongSchema,
} from "@oioi-bwg/contracts/song";
import { deleteSong, editSong } from "@oioi-bwg/server/services/song-service";

import { getRequestContext } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";
import { assertConsoleOrigin } from "@/server/http/console-origin";

interface SongRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: SongRouteContext) {
  try {
    const { id } = adminSongIdParamsSchema.parse(await context.params);
    const input = await parseJsonRequest(request, updateAdminSongSchema);
    const song = await editSong(await getRequestContext(), id, input);
    return jsonResponse(adminSongMutationResultSchema, song);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: SongRouteContext) {
  try {
    assertConsoleOrigin(request.headers);
    const { id } = adminSongIdParamsSchema.parse(await context.params);
    await deleteSong(await getRequestContext(), id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
