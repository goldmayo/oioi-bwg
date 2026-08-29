import "server-only";

import { z } from "zod";

import { apiErrorResponseSchema } from "@/shared/contracts/error";
import { logger } from "@/shared/lib/sentry";

import { AppError, type AppErrorCode } from "../errors/app-error";

const appErrorDefinitions = {
  ALBUM_NOT_FOUND: { message: "앨범을 찾을 수 없습니다.", status: 404 },
  SONG_NOT_FOUND: { message: "곡을 찾을 수 없습니다.", status: 404 },
} satisfies Record<AppErrorCode, { message: string; status: number }>;

/** 성공 payload를 외부 DTO contract로 검증한 뒤 반환한다. */
export function jsonResponse<T>(schema: z.ZodType<T>, value: unknown): Response {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new Error("API response contract violation", { cause: parsed.error });
  }

  return Response.json(parsed.data);
}

/** Route Handler boundary에서만 application error를 HTTP failure contract로 변환한다. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return Response.json(
      apiErrorResponseSchema.parse({
        code: "VALIDATION_ERROR",
        message: "입력값이 올바르지 않습니다.",
      }),
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    const definition = appErrorDefinitions[error.code];
    return Response.json(
      apiErrorResponseSchema.parse({ code: error.code, message: definition.message }),
      { status: definition.status },
    );
  }

  logger.error(error, { source: "api-route-handler" });
  return Response.json(
    apiErrorResponseSchema.parse({
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    }),
    { status: 500 },
  );
}
