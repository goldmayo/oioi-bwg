import { eq } from "drizzle-orm";

import { getDb } from "./index";
import { album, InsertAlbum, InsertSong, song as songTable } from "./schema";

// === Album Actions ===

export async function createAlbum(data: InsertAlbum) {
  const db = getDb();
  try {
    await db.insert(album).values(data);
    return { success: true };
  } catch (error) {
    console.error("Failed to create album:", error);
    return { success: false, error: "앨범 생성에 실패했습니다." };
  }
}

export async function updateAlbumInfo(id: number, data: Partial<InsertAlbum>) {
  const db = getDb();
  try {
    await db.update(album).set(data).where(eq(album.id, id));
    return { success: true };
  } catch (error) {
    console.error("Failed to update album:", error);
    return { success: false, error: "앨범 수정에 실패했습니다." };
  }
}

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

  return result;
}

/**
 * 곡 삭제 명령
 */
export async function deleteSong(id: number) {
  const db = getDb();
  const result = await db.delete(songTable).where(eq(songTable.id, id));

  return result;
}
