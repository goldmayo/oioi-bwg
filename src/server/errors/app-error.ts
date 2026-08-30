import "server-only";

export type AppErrorCode =
  | "ALBUM_NOT_FOUND"
  | "SONG_NOT_FOUND"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "OTP_COOLDOWN"
  | "OTP_RATE_LIMITED"
  | "OTP_EXPIRED"
  | "OTP_INVALID"
  | "OTP_ATTEMPTS_EXCEEDED"
  | "OTP_NOT_VERIFIED";

/** HTTP에 독립적인 예상 application failure다. */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = "AppError";
  }
}
