import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";
import { albumSummarySchema, type SaveAdminAlbum } from "@/shared/contracts/album";

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
