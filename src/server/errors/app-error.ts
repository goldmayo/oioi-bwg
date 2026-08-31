import "server-only";

export type AppErrorCode =
  | "ALBUM_NOT_FOUND"
  | "ALBUM_SLUG_ALREADY_EXISTS"
  | "SONG_NOT_FOUND"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "OTP_COOLDOWN"
  | "OTP_RATE_LIMITED"
  | "OTP_EXPIRED"
  | "OTP_INVALID"
  | "OTP_ATTEMPTS_EXCEEDED"
  | "OTP_NOT_VERIFIED"
  | "EMAIL_ALREADY_REGISTERED"
  | "NICKNAME_ALREADY_REGISTERED";

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
