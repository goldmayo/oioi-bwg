import "server-only";

import type { AppErrorCode } from "@/shared/contracts/error";

export type { AppErrorCode } from "@/shared/contracts/error";

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
