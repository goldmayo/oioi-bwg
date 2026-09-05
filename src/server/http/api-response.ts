import "server-only";

import { z } from "zod";

import { reportServerError } from "@/server/observability/server-logger";

import { apiErrorResponseSchema } from "@/shared/contracts/error";

import { AppError, type AppErrorCode } from "../errors/app-error";

const appErrorDefinitions = {
  ALBUM_NOT_FOUND: { message: "앨범을 찾을 수 없습니다.", status: 404 },
  ALBUM_SLUG_ALREADY_EXISTS: { message: "이미 사용 중인 앨범 slug입니다.", status: 409 },
  SONG_NOT_FOUND: { message: "곡을 찾을 수 없습니다.", status: 404 },
  SONG_LYRICS_INVALID: { message: "LRC에서 유효한 가사를 찾을 수 없습니다.", status: 400 },
  UNAUTHENTICATED: { message: "로그인이 필요합니다.", status: 401 },
  FORBIDDEN: { message: "접근 권한이 없습니다.", status: 403 },
  OTP_COOLDOWN: { message: "잠시 후 다시 요청해 주세요.", status: 429 },
  OTP_RATE_LIMITED: { message: "요청 횟수를 초과했습니다.", status: 429 },
  OTP_EXPIRED: { message: "인증 코드가 만료되었습니다.", status: 400 },
  OTP_INVALID: { message: "인증 코드가 올바르지 않습니다.", status: 400 },
  OTP_ATTEMPTS_EXCEEDED: { message: "인증 시도 횟수를 초과했습니다.", status: 400 },
  OTP_NOT_VERIFIED: { message: "이메일 인증을 먼저 완료해 주세요.", status: 400 },
  EMAIL_ALREADY_REGISTERED: { message: "이미 등록된 이메일입니다.", status: 409 },
  NICKNAME_ALREADY_REGISTERED: { message: "이미 사용 중인 닉네임입니다.", status: 409 },
} satisfies Record<AppErrorCode, { message: string; status: number }>;

class InvalidJsonBodyError extends Error {
  constructor(options?: ErrorOptions) {
    super("Invalid JSON request body", options);
    this.name = "InvalidJsonBodyError";
  }
}

class OutputContractError extends Error {
  constructor() {
    super("API response contract violation");
    this.name = "OutputContractError";
  }
}

/** JSON syntax failure와 schema failure를 모두 request validation failure로 보존한다. */
export async function parseJsonRequest<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;

  try {
    value = await request.json();
  } catch (error) {
    throw new InvalidJsonBodyError({ cause: error });
  }

  return schema.parse(value);
}

/** 성공 payload를 외부 DTO contract로 검증한 뒤 반환한다. */
export function jsonResponse<T>(
  schema: z.ZodType<T>,
  value: unknown,
  init?: ResponseInit,
): Response {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new OutputContractError();
  }

  return Response.json(parsed.data, init);
}

/** Route Handler boundary에서만 application error를 HTTP failure contract로 변환한다. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof InvalidJsonBodyError) {
    return Response.json(
      apiErrorResponseSchema.parse({
        code: "VALIDATION_ERROR",
        message: "요청 본문이 올바른 JSON 형식이 아닙니다.",
      }),
      { status: 400 },
    );
  }

  if (error instanceof z.ZodError) {
    const fieldErrors = Object.fromEntries(
      Object.entries(z.flattenError(error).fieldErrors).filter(
        (entry): entry is [string, string[]] => Array.isArray(entry[1]),
      ),
    );

    return Response.json(
      apiErrorResponseSchema.parse({
        code: "VALIDATION_ERROR",
        message: "입력값이 올바르지 않습니다.",
        details: { fieldErrors },
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

  const isOutputContractError = error instanceof OutputContractError;
  reportServerError(error, {
    event: isOutputContractError ? "api.output_contract_violation" : "api.unexpected_error",
    source: "api-route-handler",
    ...(isOutputContractError
      ? { error: { type: "output-contract" as const, code: "OUTPUT_CONTRACT_VIOLATION" } }
      : {}),
  });
  return Response.json(
    apiErrorResponseSchema.parse({
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    }),
    { status: 500 },
  );
}
