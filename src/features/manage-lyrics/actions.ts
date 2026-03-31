"use server";

import { revalidatePath } from "next/cache";

import { updateSong } from "@/shared/api/db/drizzle/commands";
import { LyricsDataSchema } from "@/shared/types/lyrics";

/**
 * 가사 데이터 저장 액션
 */
export async function saveSongData(songId: number, data: { lyrics: unknown; youtubeId: string }) {
  try {
    const validatedLyrics = LyricsDataSchema.parse(data.lyrics);

    /**
     * [Drizzle/Commands] updateSong 내부에서 이미 updateTag를 수행합니다.
     * 따라서 데이터베이스 레벨의 캐시는 즉시 갱신됩니다.
     */
    await updateSong(songId, {
      lyrics: validatedLyrics,
      youtubeId: data.youtubeId,
    });

    /**
     * 클라이언트 라우터 캐시 및 페이지 레이아웃 재검증
     * 루트 경로의 레이아웃을 무효화하여 모든 하위 경로(메인, 상세, 어드민)의 일관성을 맞춥니다.
     */
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Failed to save song data:", error);
    return { success: false, error: "데이터 검증 또는 저장에 실패했습니다." };
  }
}
