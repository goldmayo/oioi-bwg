import { getRequestContext } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { saveSongLyrics } from "@/server/services/song-service";

import {
  adminSongIdParamsSchema,
  adminSongMutationResultSchema,
  saveAdminSongLyricsSchema,
} from "@/shared/contracts/song";

interface SongLyricsRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: SongLyricsRouteContext) {
  try {
    const { id } = adminSongIdParamsSchema.parse(await context.params);
    const input = saveAdminSongLyricsSchema.parse(await request.json());
    const song = await saveSongLyrics(await getRequestContext(), id, input);
    return jsonResponse(adminSongMutationResultSchema, song);
  } catch (error) {
    return toErrorResponse(error);
  }
}
