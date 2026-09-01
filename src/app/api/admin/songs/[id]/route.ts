import { getRequestContext } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { deleteSong, editSong } from "@/server/services/song-service";

import {
  adminSongIdParamsSchema,
  adminSongMutationResultSchema,
  updateAdminSongSchema,
} from "@/shared/contracts/song";

interface SongRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: SongRouteContext) {
  try {
    const { id } = adminSongIdParamsSchema.parse(await context.params);
    const input = updateAdminSongSchema.parse(await request.json());
    const song = await editSong(await getRequestContext(), id, input);
    return jsonResponse(adminSongMutationResultSchema, song);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: SongRouteContext) {
  try {
    const { id } = adminSongIdParamsSchema.parse(await context.params);
    await deleteSong(await getRequestContext(), id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
