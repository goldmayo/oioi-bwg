"use server";

import { songEditSchema, songFormSchema } from "@/features/manage-song";

import { getRequestContext } from "@/server/auth/request-context";
import { createSong, deleteSong, editSong } from "@/server/services/song-service";

export async function createSongAction(formData: unknown) {
  try {
    const parsed = songFormSchema.parse(formData);
    await createSong(await getRequestContext(), parsed);
    return { success: true };
  } catch (error) {
    console.error("Failed to create song:", error);
    return { success: false, error: "곡 생성에 실패했습니다." };
  }
}

export async function updateSongAction(id: number, formData: unknown) {
  try {
    const parsed = songEditSchema.parse(formData);
    await editSong(await getRequestContext(), id, parsed);
    return { success: true };
  } catch (error) {
    console.error("Failed to update song:", error);
    return { success: false, error: "곡 수정에 실패했습니다." };
  }
}

export async function deleteSongAction(id: number) {
  try {
    await deleteSong(await getRequestContext(), id);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete song:", error);
    return { success: false, error: "곡 삭제에 실패했습니다." };
  }
}
