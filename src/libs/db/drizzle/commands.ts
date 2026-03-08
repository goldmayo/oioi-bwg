import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";

import { getDb } from "./index";
import { InsertSong, song as songTable } from "./schema";

/**
 * 곡 데이터 업데이트 명령 (Partial<InsertSong> 활용)
 */
export async function updateSong(id: number, data: Partial<InsertSong>) {
  const db = getDb();
  const result = await db
    .update(songTable)
    .set({
      ...data,
      updatedAt: new Date().toISOString(), // 공통 업데이트 로직 강제
    })
    .where(eq(songTable.id, id));

  // 데이터 변경 시 관련 캐시 즉시 갱신 (Next.js 16 updateTag 적용)
  updateTag("songs");
  updateTag(`song-id-${id}`);

  return result;
}

/**
 * 새 곡 추가 명령
 */
export async function createSong(data: InsertSong) {
  const db = getDb();
  const result = await db.insert(songTable).values({
    ...data,
    createdAt: data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  });

  // 새 데이터 추가 시 목록 캐시 즉시 갱신
  updateTag("songs");

  return result;
}

/**
 * 곡 삭제 명령
 */
export async function deleteSong(id: number) {
  const db = getDb();
  const result = await db.delete(songTable).where(eq(songTable.id, id));

  // 데이터 삭제 시 관련 캐시 즉시 갱신
  updateTag("songs");
  updateTag(`song-id-${id}`);

  return result;
}
