import { getRequestContext } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";
import { createAlbum, listAdminAlbums } from "@/server/services/album-service";

import { albumSummarySchema, saveAdminAlbumSchema } from "@/shared/contracts/album";

export async function GET() {
  try {
    const albums = await listAdminAlbums(await getRequestContext());
    return jsonResponse(albumSummarySchema.array(), albums);
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
