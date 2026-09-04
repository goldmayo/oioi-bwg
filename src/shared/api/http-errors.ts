import { isHTTPError, isNetworkError, isTimeoutError } from "ky";
import { z } from "zod";

import {
  type ApiErrorCode,
  type ApiErrorResponse,
  apiErrorResponseSchema,
  validationErrorDetailsSchema,
} from "@/shared/contracts/error";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: ApiErrorResponse["details"];

  constructor(status: number, response: ApiErrorResponse) {
    super(response.message);
    this.name = "ApiError";
    this.status = status;
    this.code = response.code;
    this.details = response.details;
  }
}

export type ClientTransportErrorCode = "HTTP_ERROR" | "NETWORK_ERROR" | "TIMEOUT_ERROR";

/** API 실패 계약 바깥에서 발생한 브라우저 transport 오류다. */
export class ClientTransportError extends Error {
  constructor(
    readonly code: ClientTransportErrorCode,
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ClientTransportError";
  }
}

export class ClientContractError extends Error {
  readonly cause: z.ZodError;

  constructor(cause: z.ZodError) {
    super("API response contract violation");
    this.name = "ClientContractError";
    this.cause = cause;
  }
}

export function parseClientResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ClientContractError(result.error);
  }

  return result.data;
}

export function normalizeHttpError(error: unknown): unknown {
  if (isTimeoutError(error)) {
    return new ClientTransportError("TIMEOUT_ERROR", "요청 시간이 초과되었습니다.", undefined, {
      cause: error,
    });
  }

  if (isNetworkError(error)) {
    return new ClientTransportError("NETWORK_ERROR", "네트워크 연결을 확인해 주세요.", undefined, {
      cause: error,
    });
  }

  if (!isHTTPError(error)) return error;

  const parsed = apiErrorResponseSchema.safeParse(error.data);

  if (parsed.success) {
    return new ApiError(error.response.status, parsed.data);
  }

  return new ClientTransportError(
    "HTTP_ERROR",
    "서버 응답을 처리하지 못했습니다.",
    error.response.status,
    { cause: error },
  );
}

/** VALIDATION_ERROR의 공개 field 오류만 안전하게 추출한다. */
export function getValidationFieldErrors(error: unknown): Record<string, string[]> | undefined {
  if (!(error instanceof ApiError) || error.code !== "VALIDATION_ERROR") return undefined;

  return validationErrorDetailsSchema.safeParse(error.details).data?.fieldErrors;
}
