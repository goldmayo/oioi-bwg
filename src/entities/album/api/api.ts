import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";
import { albumDetailSchema } from "@/shared/contracts/album";

/** 공개 앨범 HTTP 어댑터. URL 조합과 응답 검증을 한 곳에서 수행한다. */
export async function getAlbumDetail(slug: string, signal?: AbortSignal) {
  const data = await http.get(`/api/albums/${encodeURIComponent(slug)}`, { signal });
  return parseClientResponse(albumDetailSchema, data);
}
