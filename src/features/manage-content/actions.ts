"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { updateTag } from "next/cache";

import { getDb } from "@/shared/api/db/drizzle/index";
import { album, InsertAlbum, InsertSong, song as songTable } from "@/shared/api/db/drizzle/schema";
import { LyricsDataSchema } from "@/shared/types/schema/lyrics.schema";
import { parseLrc } from "@/shared/utils/lrc-parser";

import { AlbumFormSchema, SongEditSchema, SongFormSchema } from "./schemas";

// ════════════════════════════════════════════════════════════════════════════════
// Album Actions
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 앨범 생성 Server Action
 */
export async function createAlbumAction(formData: unknown) {
  try {
    const parsed = AlbumFormSchema.parse(formData);
    const db = getDb();

    const insertData: InsertAlbum = {
      name: parsed.name,
      slug: parsed.slug,
      imgUrl: parsed.imgUrl,
      color: parsed.color,
      releaseDate: parsed.releaseDate || null,
      isVisible: parsed.isVisible,
    };

    await db.insert(album).values(insertData);
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Failed to create album:", error);
    return { success: false, error: "앨범 생성에 실패했습니다." };
  }
}

/**
 * 앨범 수정 Server Action
 */
export async function updateAlbumAction(id: number, formData: unknown) {
  try {
    const parsed = AlbumFormSchema.parse(formData);
    const db = getDb();

    await db
      .update(album)
      .set({
        name: parsed.name,
        slug: parsed.slug,
        imgUrl: parsed.imgUrl,
        color: parsed.color,
        releaseDate: parsed.releaseDate || null,
        isVisible: parsed.isVisible,
      })
      .where(eq(album.id, id));

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Failed to update album:", error);
    return { success: false, error: "앨범 수정에 실패했습니다." };
  }
}

/**
 * 앨범 삭제 Server Action
 * 주의: onDelete: "cascade"로 소속 곡도 함께 삭제됩니다.
 */
export async function deleteAlbumAction(id: number) {
  try {
    const db = getDb();
    await db.delete(album).where(eq(album.id, id));

    revalidatePath("/", "layout");
    updateTag("songs");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete album:", error);
    return { success: false, error: "앨범 삭제에 실패했습니다." };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Song Actions
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 곡 생성 Server Action (LRC 파일 필수)
 */
export async function createSongAction(formData: unknown) {
  try {
    const parsed = SongFormSchema.parse(formData);
    const db = getDb();

    // LRC 텍스트를 파싱하여 lyrics 생성
    const parsedLyrics = parseLrc(parsed.lrcText);
    if (parsedLyrics.length === 0) {
      return { success: false, error: "LRC 파일에서 유효한 가사를 찾을 수 없습니다." };
    }

    // Zod로 lyrics 구조 검증
    const validatedLyrics = LyricsDataSchema.parse(parsedLyrics);

    const now = new Date().toISOString();
    const insertData: InsertSong = {
      albumId: parsed.albumId,
      title: parsed.title,
      slug: parsed.slug,
      youtubeId: parsed.youtubeId,
      lyrics: validatedLyrics,
      hasOfficialCheer: parsed.hasOfficialCheer,
      isTitle: parsed.isTitle,
      isVisible: parsed.isVisible,
      order: parsed.order,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(songTable).values(insertData);
    updateTag("songs");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Failed to create song:", error);
    return { success: false, error: "곡 생성에 실패했습니다." };
  }
}

/**
 * 곡 수정 Server Action (LRC는 선택)
 */
export async function updateSongAction(id: number, formData: unknown) {
  try {
    const parsed = SongEditSchema.parse(formData);
    const db = getDb();

    const updateData: Partial<InsertSong> = {
      albumId: parsed.albumId,
      title: parsed.title,
      slug: parsed.slug,
      youtubeId: parsed.youtubeId,
      hasOfficialCheer: parsed.hasOfficialCheer,
      isTitle: parsed.isTitle,
      isVisible: parsed.isVisible,
      order: parsed.order,
      updatedAt: new Date().toISOString(),
    };

    // LRC 텍스트가 있으면 lyrics도 업데이트
    if (parsed.lrcText) {
      const parsedLyrics = parseLrc(parsed.lrcText);
      if (parsedLyrics.length === 0) {
        return { success: false, error: "LRC 파일에서 유효한 가사를 찾을 수 없습니다." };
      }
      updateData.lyrics = LyricsDataSchema.parse(parsedLyrics);
    }

    await db.update(songTable).set(updateData).where(eq(songTable.id, id));

    updateTag("songs");
    updateTag(`song-id-${id}`);
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Failed to update song:", error);
    return { success: false, error: "곡 수정에 실패했습니다." };
  }
}

/**
 * 곡 삭제 Server Action
 */
export async function deleteSongAction(id: number) {
  try {
    const db = getDb();
    await db.delete(songTable).where(eq(songTable.id, id));

    updateTag("songs");
    updateTag(`song-id-${id}`);
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete song:", error);
    return { success: false, error: "곡 삭제에 실패했습니다." };
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Image Upload Action (Supabase Storage)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Supabase Storage에 앨범 이미지 업로드
 */
export async function uploadAlbumImageAction(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "파일이 없습니다." };
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "파일 크기는 5MB 이하여야 합니다." };
    }

    // 이미지 타입 확인
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "이미지 파일만 업로드 가능합니다." };
    }

    const { createClient } = await import("@/shared/api/db/supabase/server");
    const supabase = await createClient();

    const ext = file.name.split(".").pop();
    const fileName = `album-covers/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { success: false, error: "이미지 업로드에 실패했습니다." };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(fileName);

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error("Failed to upload image:", error);
    return { success: false, error: "이미지 업로드에 실패했습니다." };
  }
}
