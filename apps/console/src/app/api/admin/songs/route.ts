import {
  adminSongListSchema,
  adminSongMutationResultSchema,
  createAdminSongSchema,
} from "@oioi-bwg/contracts/song";
import { createSong, listAdminSongs } from "@oioi-bwg/server/services/song-service";

import { getRequestContext } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";

export async function GET() {
  try {
    const songs = await listAdminSongs(await getRequestContext());
    return jsonResponse(adminSongListSchema, songs);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await parseJsonRequest(request, createAdminSongSchema);
    const song = await createSong(await getRequestContext(), input);
    return jsonResponse(adminSongMutationResultSchema, song, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
