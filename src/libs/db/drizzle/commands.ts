import { eq } from "drizzle-orm";

import { db } from "./index";
import { InsertSong, song as songTable } from "./schema";

/**
 * 곡 데이터 업데이트 명령 (Partial<InsertSong> 활용)
 */
export async function updateSong(id: number, data: Partial<InsertSong>) {
  return await db
    .update(songTable)
    .set({
      ...data,
      updatedAt: new Date().toISOString(), // 공통 업데이트 로직 강제
    })
    .where(eq(songTable.id, id));
}

/**
 * 새 곡 추가 명령
 */
export async function createSong(data: InsertSong) {
  return await db.insert(songTable).values({
    ...data,
    createdAt: data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  });
}

/**
 * 곡 삭제 명령
 */
export async function deleteSong(id: number) {
  return await db.delete(songTable).where(eq(songTable.id, id));
}
