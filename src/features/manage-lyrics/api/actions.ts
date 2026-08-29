"use server";

import { LyricsDataSchema } from "@/entities/cheer-guide";

import { updateSong } from "@/shared/api/db/drizzle/commands";

/**
 * 가사 데이터 저장 액션
 */
export async function saveSongData(songId: number, data: { lyrics: unknown; youtubeId: string }) {
  try {
    const validatedLyrics = LyricsDataSchema.parse(data.lyrics);

    await updateSong(songId, {
      lyrics: validatedLyrics,
      youtubeId: data.youtubeId,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to save song data:", error);
    return { success: false, error: "데이터 검증 또는 저장에 실패했습니다." };
  }
}
