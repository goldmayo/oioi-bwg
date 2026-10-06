import { songDetailSchema, songSlugParamsSchema } from "@oioi-bwg/contracts/song";

import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { requireSongDetailBySlug } from "@/server/services/song-service";

interface SongRouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: SongRouteContext) {
  try {
    const { slug } = songSlugParamsSchema.parse(await context.params);
    const song = await requireSongDetailBySlug(slug);

    return jsonResponse(songDetailSchema, song);
  } catch (error) {
    return toErrorResponse(error);
  }
}
