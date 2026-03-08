import { getDb } from "./index";
import { Song } from "./schema";

/**
 * 슬러그를 기반으로 곡 정보를 조회하는 헬퍼 함수
 * 타입 단언 없이 Drizzle의 추론된 타입을 그대로 반환합니다.
 */
export async function getSongBySlug(slug: string): Promise<Song | undefined> {
  const db = getDb();
  return await db.query.song.findFirst({
    where: (s, { eq }) => eq(s.slug, slug),
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
 * 정렬 순서에 따른 전체 곡 목록 조회
 */
export async function getAllSongs(): Promise<Song[]> {
  const db = getDb();
  return await db.query.song.findMany({
    orderBy: (s, { asc }) => [asc(s.order)],
  });
}
