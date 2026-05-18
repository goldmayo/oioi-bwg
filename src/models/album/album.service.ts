import "server-only";

import { revalidatePath } from "next/cache";

import type { AlbumEntity } from "@/shared/api/db/drizzle/schema";
import type { CreateAlbumRequest } from "@/shared/types/schema/album.schema";

import * as albumRepo from "./album.repository";

// ============================================================
// 사용자 서비스
// ============================================================

export async function getAlbumsWithSongs() {
  return albumRepo.findAllAlbumsWithSongs();
}

export async function getAlbumBySlug(slug: string) {
  return albumRepo.findAlbumBySlug(slug);
}

// ============================================================
// 관리자 서비스 (비즈니스 규칙 추가 시 여기에 작성)
// ============================================================

export async function getAdminAlbums(): Promise<AlbumEntity[]> {
  return albumRepo.findAllAlbums();
}

export async function addAlbum(data: CreateAlbumRequest) {
  const result = await albumRepo.createAlbum(data);
  // 캐시 무효화 — 백엔드 분리 시 Controller(HTTP Handler)로 이동
  revalidatePath("/", "layout");
  return result;
}

export async function editAlbum(id: number, data: Partial<CreateAlbumRequest>) {
  const result = await albumRepo.updateAlbum(id, data);
  revalidatePath("/", "layout");
  return result;
}
