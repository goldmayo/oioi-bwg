import "server-only";

import { updateTag } from "next/cache";

import type { SongEntity } from "@/shared/api/db/drizzle/schema";
import type { CreateSongRequest, SongList } from "@/shared/types/schema/song.schema";

import * as songRepo from "./song.repository";

// ============================================================
// 사용자 서비스
// ============================================================

export async function getSongs(): Promise<SongList[]> {
  return songRepo.findAllSongs();
}

export async function getSongBySlug(slug: string) {
  return songRepo.findSongBySlug(slug);
}

// ============================================================
// 관리자 서비스 (비즈니스 규칙 추가 시 여기에 작성)
// ============================================================

export async function getAdminSongs() {
  return songRepo.findAllSongsWithAlbum();
}

export async function getAdminSongById(id: number): Promise<SongEntity | undefined> {
  return songRepo.findSongById(id);
}

export async function addSong(data: CreateSongRequest) {
  const result = await songRepo.createSong(data);
  // 캐시 무효화 — 백엔드 분리 시 Controller(HTTP Handler)로 이동
  updateTag("songs");
  return result;
}

export async function editSong(id: number, data: Partial<CreateSongRequest>) {
  const result = await songRepo.updateSong(id, data);
  updateTag("songs");
  updateTag(`song-id-${id}`);
  return result;
}

export async function removeSong(id: number) {
  const result = await songRepo.deleteSong(id);
  updateTag("songs");
  updateTag(`song-id-${id}`);
  return result;
}
