"use server";

import { AppError } from "@oioi-bwg/server/errors/app-error";
import { uploadAlbumImage } from "@oioi-bwg/server/services/album-image-service";
import { headers } from "next/headers";
import { ZodError } from "zod";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { assertConsoleOrigin } from "@/server/http/console-origin";
import { logAuthRejection } from "@/server/observability/auth-rejection-logger";
import { reportServerError } from "@/server/observability/server-error-reporter";

const FALLBACK_ERROR_MESSAGE = "이미지 업로드에 실패했습니다.";

/** 앨범 이미지 업로드 use case를 호출하는 route-private delivery adapter다. */
export async function uploadAlbumImageAction(formData: FormData) {
  let authorization: RequestAuthorization | undefined;
  try {
    assertConsoleOrigin(await headers());
    authorization = await getRequestAuthorization();
    const context = authorization.context;
    const { url } = await uploadAlbumImage(context, formData.get("file"));

    return { success: true, url };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message ?? FALLBACK_ERROR_MESSAGE };
    }

    if (error instanceof AppError) {
      if (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")
        logAuthRejection(authorization, "action_rejection_returned", "upload-album-image-action", {
          route: "/admin/albums",
        });
      return { success: false, error: FALLBACK_ERROR_MESSAGE };
    }

    reportServerError(error, {
      event: "upload.failure",
      source: "upload-album-image-action",
      operation: "album-image-upload",
      route: "/admin/albums",
      request: { routerKind: "App Router", routeType: "action" },
    });
    return { success: false, error: FALLBACK_ERROR_MESSAGE };
  }
}
