import { getRequestContext } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { createSong, listAdminSongs } from "@/server/services/song-service";

import {
  adminSongMutationResultSchema,
  adminSongSummarySchema,
  createAdminSongSchema,
} from "@/shared/contracts/song";

export async function GET() {
  try {
    const songs = await listAdminSongs(await getRequestContext());
    return jsonResponse(adminSongSummarySchema.array(), songs);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createAdminSongSchema.parse(await request.json());
    const song = await createSong(await getRequestContext(), input);
    return jsonResponse(adminSongMutationResultSchema, song, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
