"use server";

import { ZodError } from "zod";

import { getRequestContext } from "@/server/auth/request-context";
import { AppError } from "@/server/errors/app-error";
import { reportServerError } from "@/server/observability/server-logger";
import { uploadAlbumImage } from "@/server/services/album-image-service";

const FALLBACK_ERROR_MESSAGE = "이미지 업로드에 실패했습니다.";

/** 앨범 이미지 업로드 use case를 호출하는 route-private delivery adapter다. */
export async function uploadAlbumImageAction(formData: FormData) {
  try {
    const context = await getRequestContext();
    const { url } = await uploadAlbumImage(context, formData.get("file"));

    return { success: true, url };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message ?? FALLBACK_ERROR_MESSAGE };
    }

    if (error instanceof AppError) {
      return { success: false, error: FALLBACK_ERROR_MESSAGE };
    }

    reportServerError(error, {
      event: "upload.failure",
      source: "upload-album-image-action",
      operation: "album-image-upload",
      request: { routerKind: "App Router", routeType: "action" },
    });
    return { success: false, error: FALLBACK_ERROR_MESSAGE };
  }
}
