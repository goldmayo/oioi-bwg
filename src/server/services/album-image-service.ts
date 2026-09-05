import "server-only";

import { z } from "zod";

import { type RequestContext, requireUser } from "../auth/request-context";
import { AppError } from "../errors/app-error";
import { uploadPublicAsset } from "../storage/upload-public-asset";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = {
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const albumImageFileSchema = z
  .instanceof(File, { error: "파일이 없습니다." })
  .refine((file) => file.size <= MAX_IMAGE_SIZE, {
    message: "파일 크기는 5MB 이하여야 합니다.",
  })
  .refine((file) => file.type in IMAGE_EXTENSIONS, {
    message: "AVIF, JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.",
  });

function requireAdmin(ctx: RequestContext) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
}

/** ADMIN의 앨범 이미지를 검증한 뒤 public storage에 업로드한다. */
export async function uploadAlbumImage(ctx: RequestContext, rawFile: unknown) {
  requireAdmin(ctx);
  const file = albumImageFileSchema.parse(rawFile);
  const extension = IMAGE_EXTENSIONS[file.type as keyof typeof IMAGE_EXTENSIONS];
  const objectKey = `images/albums/${crypto.randomUUID()}.${extension}`;

  return uploadPublicAsset({
    objectKey,
    body: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type,
  });
}
