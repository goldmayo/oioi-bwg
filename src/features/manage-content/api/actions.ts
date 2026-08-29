"use server";

/**
 * Supabase Storage에 앨범 이미지를 업로드한다.
 * DB mutation은 app delivery adapter를 통해 server service로 전달한다.
 */
export async function uploadAlbumImageAction(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "파일이 없습니다." };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "파일 크기는 5MB 이하여야 합니다." };
    }

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
