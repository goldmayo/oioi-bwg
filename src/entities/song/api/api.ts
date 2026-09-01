import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";
import {
  adminSongMutationResultSchema,
  adminSongSummarySchema,
  type CreateAdminSong,
  songDetailSchema,
  type UpdateAdminSong,
} from "@/shared/contracts/song";

/** 공개 곡 HTTP 어댑터. URL 조합과 응답 검증을 한 곳에서 수행한다. */
export async function getSongDetail(slug: string, signal?: AbortSignal) {
  const data = await http.get(`/api/songs/${encodeURIComponent(slug)}`, { signal });
  return parseClientResponse(songDetailSchema, data);
}

/** 관리자 곡 목록을 조회하고 외부 응답 계약으로 검증한다. */
export async function getAdminSongs(signal?: AbortSignal) {
  const data = await http.get("/api/admin/songs", { signal });
  return parseClientResponse(adminSongSummarySchema.array(), data);
}

/** 관리자 곡을 생성하고 생성된 식별자를 검증한다. */
export async function createAdminSong(input: CreateAdminSong) {
  const data = await http.post("/api/admin/songs", { json: input });
  return parseClientResponse(adminSongMutationResultSchema, data);
}

/** 관리자 곡을 수정하고 수정된 식별자를 검증한다. */
export async function updateAdminSong(id: number, input: UpdateAdminSong) {
  const data = await http.patch(`/api/admin/songs/${id}`, { json: input });
  return parseClientResponse(adminSongMutationResultSchema, data);
}

/** 관리자 곡을 삭제한다. 성공 응답에는 JSON body가 없다. */
export async function deleteAdminSong(id: number) {
  await http.delete(`/api/admin/songs/${id}`);
}
