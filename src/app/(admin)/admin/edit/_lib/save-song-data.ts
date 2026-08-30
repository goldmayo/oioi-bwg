"use server";

import { LyricsDataSchema } from "@/entities/cheer-guide";

import { getRequestContext } from "@/server/auth/request-context";
import { saveSongLyrics } from "@/server/services/song-service";

export async function saveSongData(songId: number, data: { lyrics: unknown; youtubeId: string }) {
  try {
    const lyrics = LyricsDataSchema.parse(data.lyrics);
    await saveSongLyrics(await getRequestContext(), songId, { lyrics, youtubeId: data.youtubeId });
    return { success: true };
  } catch (error) {
    console.error("Failed to save song data:", error);
    return { success: false, error: "데이터 검증 또는 저장에 실패했습니다." };
  }
}
