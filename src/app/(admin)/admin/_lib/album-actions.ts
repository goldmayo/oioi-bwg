"use server";

import { albumFormSchema } from "@/features/manage-album";

import { createAlbum, deleteAlbum, editAlbum } from "@/server/services/album-service";

export async function createAlbumAction(formData: unknown) {
  try {
    const parsed = albumFormSchema.parse(formData);
    await createAlbum({ ...parsed, releaseDate: parsed.releaseDate || null });
    return { success: true };
  } catch (error) {
    console.error("Failed to create album:", error);
    return { success: false, error: "앨범 생성에 실패했습니다." };
  }
}

export async function updateAlbumAction(id: number, formData: unknown) {
  try {
    const parsed = albumFormSchema.parse(formData);
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
