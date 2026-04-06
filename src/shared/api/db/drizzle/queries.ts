import { getDb } from "./index";
import { Song, SongListItem } from "./schema";

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
 */
export async function getAllSongs(): Promise<SongListItem[]> {
  const db = getDb();
  return await db.query.song.findMany({
    columns: {
      id: true,
      title: true,
      slug: true,
      albumId: true,
      order: true,
      updatedAt: true,
      hasOfficialCheer: true,
      isTitle: true,
    },
    orderBy: (s, { asc }) => [asc(s.order)],
  });
}

/**
 * 메인 페이지용: 전체 앨범 목록과 그에 속한 모든 곡을 배열 형태로 조회
 */
export async function getAllAlbumsWithSongs() {
  const db = getDb();
  return await db.query.album.findMany({
    with: {
      songs: {
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
    orderBy: (a, { asc }) => [asc(a.releaseDate)],
  });
}

/**
 * 특정 슬러그를 가진 앨범 상세 정보 조회
 */
export async function getAlbumBySlug(slug: string) {
  const db = getDb();
  return await db.query.album.findFirst({
    where: (a, { eq }) => eq(a.slug, slug),
    with: {
      songs: {
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
