import {
  adminSongListSchema,
  adminSongMutationResultSchema,
  createAdminSongSchema,
} from "@oioi-bwg/contracts/song";
import { createSong, listAdminSongs } from "@oioi-bwg/server/services/song-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";

export async function GET() {
  let authorization: RequestAuthorization | undefined;
  try {
    const songs = await listAdminSongs((authorization = await getRequestAuthorization()).context);
    return jsonResponse(adminSongListSchema, songs);
  } catch (error) {
    return toErrorResponse(error, { route: "/api/admin/songs", authorization });
  }
}

export async function POST(request: Request) {
  let authorization: RequestAuthorization | undefined;
  try {
    const input = await parseJsonRequest(request, createAdminSongSchema);
    const song = await createSong((authorization = await getRequestAuthorization()).context, input);
    return jsonResponse(adminSongMutationResultSchema, song, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, { route: "/api/admin/songs", authorization });
  }
}
