import {
  adminAlbumIdParamsSchema,
  albumSummarySchema,
  saveAdminAlbumSchema,
} from "@oioi-bwg/contracts/album";
import { deleteAlbum, editAlbum } from "@oioi-bwg/server/services/album-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";
import { assertConsoleOrigin } from "@/server/http/console-origin";

interface AlbumRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: AlbumRouteContext) {
  let authorization: RequestAuthorization | undefined;
  try {
    const { id } = adminAlbumIdParamsSchema.parse(await context.params);
    const input = await parseJsonRequest(request, saveAdminAlbumSchema);
    const album = await editAlbum(
      (authorization = await getRequestAuthorization()).context,
      id,
      input,
    );
    return jsonResponse(albumSummarySchema, album);
  } catch (error) {
    return toErrorResponse(error, { route: "/api/admin/albums/[id]", authorization });
  }
}

export async function DELETE(request: Request, context: AlbumRouteContext) {
  let authorization: RequestAuthorization | undefined;
  try {
    assertConsoleOrigin(request.headers);
    const { id } = adminAlbumIdParamsSchema.parse(await context.params);
    await deleteAlbum((authorization = await getRequestAuthorization()).context, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error, { route: "/api/admin/albums/[id]", authorization });
  }
}
