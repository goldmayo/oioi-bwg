"use server";

import { AlbumFormSchema, SongEditSchema, SongFormSchema } from "@/features/manage-content";

import { LyricsDataSchema, parseLrc } from "@/entities/cheer-guide";

import { createAlbum, deleteAlbum, editAlbum } from "@/server/services/album-service";
import { createSong, deleteSong, editSong } from "@/server/services/song-service";

export async function createAlbumAction(formData: unknown) {
  try {
    const parsed = AlbumFormSchema.parse(formData);
    await createAlbum({ ...parsed, releaseDate: parsed.releaseDate || null });
    return { success: true };
  } catch (error) {
    console.error("Failed to create album:", error);
    return { success: false, error: "앨범 생성에 실패했습니다." };
  }
}

export async function updateAlbumAction(id: number, formData: unknown) {
  try {
    const parsed = AlbumFormSchema.parse(formData);
    await editAlbum(id, { ...parsed, releaseDate: parsed.releaseDate || null });
    return { success: true };
  } catch (error) {
    console.error("Failed to update album:", error);
    return { success: false, error: "앨범 수정에 실패했습니다." };
  }
}

export async function deleteAlbumAction(id: number) {
  try {
    await deleteAlbum(id);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete album:", error);
    return { success: false, error: "앨범 삭제에 실패했습니다." };
  }
}

export async function createSongAction(formData: unknown) {
  try {
    const parsed = SongFormSchema.parse(formData);
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
    const parsed = SongEditSchema.parse(formData);
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
