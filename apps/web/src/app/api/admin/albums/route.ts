import {
  adminAlbumListSchema,
  albumSummarySchema,
  saveAdminAlbumSchema,
} from "@oioi-bwg/contracts/album";
import { createAlbum, listAdminAlbums } from "@oioi-bwg/server/services/album-service";

import { getRequestContext } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";

export async function GET() {
  try {
    const albums = await listAdminAlbums(await getRequestContext());
    return jsonResponse(adminAlbumListSchema, albums);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = await parseJsonRequest(request, saveAdminAlbumSchema);
    const album = await createAlbum(await getRequestContext(), input);
    return jsonResponse(albumSummarySchema, album, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
