import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/shared/api/db/drizzle/index";
import type { AlbumEntity } from "@/shared/api/db/drizzle/schema";
import { album as albumTable } from "@/shared/api/db/drizzle/schema";
import type { CreateAlbumRequest } from "@/shared/types/schema/album.schema";

// ============================================================
// READ
// ============================================================

/**
 * 메인 페이지용: isVisible 앨범 + 소속 곡 목록
 * songs에 youtubeId 포함 — SongList와 shape 상이하므로 Drizzle 추론 반환
 */
export async function findAllAlbumsWithSongs() {
  const db = getDb();
  return db.query.album.findMany({
    where: (a, { eq }) => eq(a.isVisible, true),
    with: {
      songs: {
        where: (s, { eq }) => eq(s.isVisible, true),
        orderBy: (s, { asc }) => [asc(s.order)],
        columns: {
          id: true,
          slug: true,
          title: true,
          hasOfficialCheer: true,
          youtubeId: true,
          isTitle: true,
        },
      },
    },
    orderBy: (a, { desc }) => [desc(a.releaseDate)],
  });
}

/**
 * 상세 페이지용: slug 기반 앨범 + 소속 곡 목록
 */
export async function findAlbumBySlug(slug: string) {
  const db = getDb();
  return db.query.album.findFirst({
    where: (a, { eq }) => eq(a.slug, slug),
    with: {
      songs: {
        where: (s, { eq }) => eq(s.isVisible, true),
        orderBy: (s, { asc }) => [asc(s.order)],
        columns: {
          id: true,
          slug: true,
          title: true,
          hasOfficialCheer: true,
          youtubeId: true,
          isTitle: true,
        },
      },
    },
  });
}

/**
 * 관리자용: 전체 앨범 목록 (isVisible 필터 없음)
 * AlbumEntity 직접 반환 — 관리자 Service에서만 사용
 */
export async function findAllAlbums(): Promise<AlbumEntity[]> {
  const db = getDb();
  return db.query.album.findMany({
    orderBy: (a, { asc }) => [asc(a.releaseDate)],
  });
}

// ============================================================
// WRITE
// (캐시 무효화 revalidatePath/updateTag는 Controller(Server Action) 담당)
// ============================================================

export async function createAlbum(data: CreateAlbumRequest) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.insert(albumTable).values({
    ...data,
    createdAt: now,
  });
}

export async function updateAlbum(id: number, data: Partial<CreateAlbumRequest>) {
  const db = getDb();
  return db.update(albumTable).set(data).where(eq(albumTable.id, id));
}
