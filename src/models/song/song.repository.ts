import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/shared/api/db/drizzle/index";
import type { SongEntity } from "@/shared/api/db/drizzle/schema";
import { song as songTable } from "@/shared/api/db/drizzle/schema";
import type { CreateSongRequest, SongList } from "@/shared/types/schema/song.schema";
import { SongListSchema } from "@/shared/types/schema/song.schema";

// ============================================================
// READ
// ============================================================

/**
 * 사용자 대상: 가사 제외 목록 (isVisible=true)
 * SongEntity → SongList 변환 후 반환 (Entity 외부 노출 금지)
 */
export async function findAllSongs(): Promise<SongList[]> {
  const db = getDb();
  const raw = await db.query.song.findMany({
    where: (s, { eq }) => eq(s.isVisible, true),
    columns: {
      id: true,
      title: true,
      slug: true,
      albumId: true,
      order: true,
      updatedAt: true,
      hasOfficialCheer: true,
      isTitle: true,
      isVisible: true,
    },
    orderBy: (s, { asc }) => [asc(s.order)],
  });
  return SongListSchema.array().parse(raw);
}

/**
 * 관리자용: 전체 곡 + 앨범명 포함 (isVisible 필터 없음)
 * Drizzle 추론 타입 반환 — 관리자 전용, 경계 외부로 노출 금지
 */
export async function findAllSongsWithAlbum() {
  const db = getDb();
  return db.query.song.findMany({
    columns: {
      id: true,
      title: true,
      slug: true,
      albumId: true,
      order: true,
      youtubeId: true,
      updatedAt: true,
      hasOfficialCheer: true,
      isTitle: true,
      isVisible: true,
    },
    with: {
      album: { columns: { name: true } },
    },
    orderBy: (s, { asc }) => [asc(s.albumId), asc(s.order)],
  });
}

/**
 * 관리자용: ID 기반 단건
 * SongEntity 직접 반환 — Repository 내부 또는 관리자 Service에서만 사용
 */
export async function findSongById(id: number): Promise<SongEntity | undefined> {
  const db = getDb();
  return db.query.song.findFirst({
    where: (s, { eq }) => eq(s.id, id),
  });
}

/**
 * 상세 페이지용: slug 기반 단건 + album 관계 포함
 * Drizzle 추론 타입 반환 (lyrics: unknown 포함) — Service에서 필요 시 parse
 */
export async function findSongBySlug(slug: string) {
  const db = getDb();
  return db.query.song.findFirst({
    where: (s, { eq }) => eq(s.slug, slug),
    with: {
      album: {
        with: { songs: true },
      },
    },
  });
}

// ============================================================
// WRITE
// (캐시 무효화 revalidatePath/updateTag는 Controller(Server Action) 담당)
// ============================================================

export async function createSong(data: CreateSongRequest) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.insert(songTable).values({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateSong(id: number, data: Partial<CreateSongRequest>) {
  const db = getDb();
  return db
    .update(songTable)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(songTable.id, id));
}

export async function deleteSong(id: number) {
  const db = getDb();
  return db.delete(songTable).where(eq(songTable.id, id));
}
