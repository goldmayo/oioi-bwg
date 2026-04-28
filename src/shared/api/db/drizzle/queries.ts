import { getDb } from "./index";
import { Album, Song, SongListItem } from "./schema";

/**
 * 슬러그를 기반으로 곡 정보를 앨범 정보와 함께 조회하는 헬퍼 함수
 */
export async function getSongBySlug(slug: string) {
  const db = getDb();
  return await db.query.song.findFirst({
    where: (s, { eq }) => eq(s.slug, slug),
    with: {
      album: {
        with: {
          songs: true,
        },
      },
    },
  });
}

/**
 * 관리자용: ID를 기반으로 곡 정보를 조회
 */
export async function getSongById(id: number): Promise<Song | undefined> {
  const db = getDb();
  return await db.query.song.findFirst({
    where: (s, { eq }) => eq(s.id, id),
  });
}

/**
 * 정렬 순서에 따른 전체 곡 목록 조회 (앨범 참조 ID 포함)
 * 사용자 대상: isVisible=true인 곡만 조회
 */
export async function getAllSongs(): Promise<SongListItem[]> {
  const db = getDb();
  return await db.query.song.findMany({
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
}

/**
 * 메인 페이지용: 전체 앨범 목록과 그에 속한 모든 곡을 배열 형태로 조회
 * - isVisible=true인 앨범만 조회
 * - 소속 곡도 isVisible=true인 곡만 포함
 * - 최신 발매일 순 (desc) 정렬
 */
export async function getAllAlbumsWithSongs() {
  const db = getDb();
  return await db.query.album.findMany({
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
 * 특정 슬러그를 가진 앨범 상세 정보 조회
 * 소속 곡은 isVisible=true인 곡만 포함
 */
export async function getAlbumBySlug(slug: string) {
  const db = getDb();
  return await db.query.album.findFirst({
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
 * 관리자용: 전체 앨범 목록 조회 (isVisible 필터 없음)
 */
export async function getAllAlbums(): Promise<Album[]> {
  const db = getDb();
  return await db.query.album.findMany({
    orderBy: (a, { asc }) => [asc(a.releaseDate)],
  });
}

/**
 * 관리자용: 전체 곡 목록 + 앨범명 포함 조회 (isVisible 필터 없음)
 */
export async function getSongsWithAlbum() {
  const db = getDb();
  return await db.query.song.findMany({
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
      album: {
        columns: { name: true },
      },
    },
    orderBy: (s, { asc }) => [asc(s.albumId), asc(s.order)],
  });
}

