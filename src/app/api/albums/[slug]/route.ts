import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { requireAlbumDetailBySlug } from "@/server/services/album-service";

import { albumDetailSchema, albumSlugParamsSchema } from "@/shared/contracts/album";

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
