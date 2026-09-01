import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";
import {
  albumDetailSchema,
  albumSummarySchema,
  type SaveAdminAlbum,
} from "@/shared/contracts/album";

/** 공개 앨범 HTTP 어댑터. URL 조합과 응답 검증을 한 곳에서 수행한다. */
export async function getAlbumDetail(slug: string, signal?: AbortSignal) {
  const data = await http.get(`/api/albums/${encodeURIComponent(slug)}`, { signal });
  return parseClientResponse(albumDetailSchema, data);
}

/** 관리자 앨범 목록을 조회하고 외부 응답 계약으로 검증한다. */
export async function getAdminAlbums(signal?: AbortSignal) {
  const data = await http.get("/api/admin/albums", { signal });
  return parseClientResponse(albumSummarySchema.array(), data);
}

/** 관리자 앨범을 생성하고 검증된 응답 DTO를 반환한다. */
export async function createAdminAlbum(input: SaveAdminAlbum) {
  const data = await http.post("/api/admin/albums", { json: input });
  return parseClientResponse(albumSummarySchema, data);
}

/** 관리자 앨범을 수정하고 검증된 응답 DTO를 반환한다. */
export async function updateAdminAlbum(id: number, input: SaveAdminAlbum) {
  const data = await http.patch(`/api/admin/albums/${id}`, { json: input });
  return parseClientResponse(albumSummarySchema, data);
}

/** 관리자 앨범을 삭제한다. 성공 응답에는 JSON body가 없다. */
export async function deleteAdminAlbum(id: number) {
  await http.delete(`/api/admin/albums/${id}`);
}
