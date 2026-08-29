"use server";

import { songEditSchema, songFormSchema } from "@/features/manage-song";

import { LyricsDataSchema, parseLrc } from "@/entities/cheer-guide";

import { createSong, deleteSong, editSong } from "@/server/services/song-service";

export async function createSongAction(formData: unknown) {
  try {
    const parsed = songFormSchema.parse(formData);
    const parsedLyrics = parseLrc(parsed.lrcText);

    if (parsedLyrics.length === 0) {
      return { success: false, error: "LRC 파일에서 유효한 가사를 찾을 수 없습니다." };
    }

    const lyrics = LyricsDataSchema.parse(parsedLyrics);
    await createSong({ ...parsed, lyrics });
    return { success: true };
  } catch (error) {
    console.error("Failed to create song:", error);
    return { success: false, error: "곡 생성에 실패했습니다." };
  }
}

export async function updateSongAction(id: number, formData: unknown) {
  try {
    const parsed = songEditSchema.parse(formData);
    const { lrcText, ...input } = parsed;

    if (!lrcText) {
      await editSong(id, input);
      return { success: true };
    }

    const parsedLyrics = parseLrc(lrcText);
    if (parsedLyrics.length === 0) {
      return { success: false, error: "LRC 파일에서 유효한 가사를 찾을 수 없습니다." };
    }

    await editSong(id, {
      ...input,
      lyrics: LyricsDataSchema.parse(parsedLyrics),
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to update song:", error);
    return { success: false, error: "곡 수정에 실패했습니다." };
  }
}

export async function deleteSongAction(id: number) {
  try {
    await deleteSong(id);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete song:", error);
    return { success: false, error: "곡 삭제에 실패했습니다." };
  }
}
