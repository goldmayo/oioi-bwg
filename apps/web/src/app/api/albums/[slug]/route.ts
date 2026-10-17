import { albumDetailSchema, albumSlugParamsSchema } from "@oioi-bwg/contracts/album";
import { requireAlbumDetailBySlug } from "@oioi-bwg/server/services/album-service";

import { jsonResponse, toErrorResponse } from "@/server/http/api-response";

interface AlbumRouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: AlbumRouteContext) {
  try {
    const { slug } = albumSlugParamsSchema.parse(await context.params);
    const album = await requireAlbumDetailBySlug(slug);

    return jsonResponse(albumDetailSchema, album);
  } catch (error) {
    return toErrorResponse(error);
  }
}
