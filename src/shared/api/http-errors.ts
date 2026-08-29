import { isHTTPError } from "ky";
import { z } from "zod";

import { type ApiErrorResponse, apiErrorResponseSchema } from "@/shared/contracts/error";
import { logger } from "@/shared/lib/sentry";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, response: ApiErrorResponse) {
    super(response.message);
    this.name = "ApiError";
    this.status = status;
    this.code = response.code;
    this.details = response.details;
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
    const error = new ClientContractError(result.error);
    logger.error(error, { source: "api-response-contract" });
    throw error;
  }

  return result.data;
}

export function normalizeHttpError(error: unknown): unknown {
  if (!isHTTPError(error)) return error;

  const parsed = apiErrorResponseSchema.safeParse(error.data);

  if (parsed.success) {
    return new ApiError(error.response.status, parsed.data);
  }

  return new ApiError(error.response.status, {
    code: "HTTP_ERROR",
    message: "요청을 처리하지 못했습니다.",
  });
}
