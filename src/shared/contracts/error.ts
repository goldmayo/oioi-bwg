import { z } from "zod";

export const appErrorCodeSchema = z.enum([
  "ALBUM_NOT_FOUND",
  "ALBUM_SLUG_ALREADY_EXISTS",
  "SONG_NOT_FOUND",
  "SONG_LYRICS_INVALID",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "OTP_COOLDOWN",
  "OTP_RATE_LIMITED",
  "OTP_EXPIRED",
  "OTP_INVALID",
  "OTP_ATTEMPTS_EXCEEDED",
  "OTP_NOT_VERIFIED",
  "EMAIL_ALREADY_REGISTERED",
  "NICKNAME_ALREADY_REGISTERED",
]);

export const apiErrorCodeSchema = z.enum([
  ...appErrorCodeSchema.options,
  "VALIDATION_ERROR",
  "INTERNAL_SERVER_ERROR",
]);

export const validationErrorDetailsSchema = z.object({
  fieldErrors: z.record(z.string(), z.array(z.string())),
});

/** 모든 Route Handler 실패가 반환하는 공개 오류 payload다. */
export const apiErrorResponseSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
  details: validationErrorDetailsSchema.optional(),
});

export type AppErrorCode = z.infer<typeof appErrorCodeSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ValidationErrorDetails = z.infer<typeof validationErrorDetailsSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
