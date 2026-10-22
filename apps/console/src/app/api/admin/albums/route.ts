import {
  adminAlbumListSchema,
  albumSummarySchema,
  saveAdminAlbumSchema,
} from "@oioi-bwg/contracts/album";
import { createAlbum, listAdminAlbums } from "@oioi-bwg/server/services/album-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";

export async function GET() {
  let authorization: RequestAuthorization | undefined;
  try {
    const albums = await listAdminAlbums((authorization = await getRequestAuthorization()).context);
    return jsonResponse(adminAlbumListSchema, albums);
  } catch (error) {
    return toErrorResponse(error, { route: "/api/admin/albums", authorization });
  }
}

export async function POST(request: Request) {
  let authorization: RequestAuthorization | undefined;
  try {
    const input = await parseJsonRequest(request, saveAdminAlbumSchema);
    const album = await createAlbum(
      (authorization = await getRequestAuthorization()).context,
      input,
    );
    return jsonResponse(albumSummarySchema, album, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, { route: "/api/admin/albums", authorization });
  }
}
