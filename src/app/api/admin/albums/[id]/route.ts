import { getRequestContext } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { deleteAlbum, editAlbum } from "@/server/services/album-service";

import {
  adminAlbumIdParamsSchema,
  albumSummarySchema,
  saveAdminAlbumSchema,
} from "@/shared/contracts/album";

interface AlbumRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: AlbumRouteContext) {
  try {
    const { id } = adminAlbumIdParamsSchema.parse(await context.params);
    const input = saveAdminAlbumSchema.parse(await request.json());
    const album = await editAlbum(await getRequestContext(), id, input);
    return jsonResponse(albumSummarySchema, album);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: AlbumRouteContext) {
  try {
    const { id } = adminAlbumIdParamsSchema.parse(await context.params);
    await deleteAlbum(await getRequestContext(), id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
