"use server";

import { uploadPublicAsset } from "@/shared/api/r2/upload-public-asset";

const IMAGE_EXTENSIONS = {
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

/**
 * R2에 앨범 이미지를 업로드한다.
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

    if (!(file.type in IMAGE_EXTENSIONS)) {
      return { success: false, error: "AVIF, JPEG, PNG, WebP 이미지만 업로드할 수 있습니다." };
    }

    const objectKey = `images/albums/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type as keyof typeof IMAGE_EXTENSIONS]}`;
    const { url } = await uploadPublicAsset({
      objectKey,
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    });

    return { success: true, url };
  } catch (error) {
    console.error("Failed to upload image:", error);
    return { success: false, error: "이미지 업로드에 실패했습니다." };
  }
}
