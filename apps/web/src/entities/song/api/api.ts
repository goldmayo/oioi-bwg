import { songDetailSchema } from "@oioi-bwg/contracts/song";

import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";

/** 공개 곡 HTTP 어댑터. URL 조합과 응답 검증을 한 곳에서 수행한다. */
export async function getSongDetail(slug: string, signal?: AbortSignal) {
  const data = await http.get(`/api/songs/${encodeURIComponent(slug)}`, { signal });
  return parseClientResponse(songDetailSchema, data);
}
