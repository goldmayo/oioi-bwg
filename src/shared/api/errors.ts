import { ApiError, ApiMetadata, FieldError } from "@/shared/types/api";

export const ERROR_CODE = {
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/**
 * [구현체] 개별 필드 에러 정보를 담는 클래스
 */
export class FieldViolation implements FieldError {
  constructor(
    public field: string,
    public reason: string,
    public value?: unknown,
  ) {}
}

/**
 * [구현체] 서버 에러의 베이스 클래스
 */
export class ServerError extends Error {
  public code: ErrorCode;
  public details: ApiError["details"];
  public meta?: ApiMetadata;

  constructor(
    error: { code: string; message: string; details?: ApiError["details"] },
    meta?: ApiMetadata,
  ) {
    super(error.message);
    this.name = "ServerError";
    this.code = error.code as ErrorCode; // 외부 string 타입을 내부 ErrorCode 타입으로 캐스팅
    this.details = error.details;
    this.meta = meta;
  }

  /**
   * 인터페이스 규격인 ApiError 객체로 변환
   */
  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * [구현체] 유효성 검사 에러 전용 클래스
 */
export class ValidationError extends ServerError {
  constructor(fieldErrors: FieldViolation[], message: string = "입력값이 올바르지 않습니다.") {
    super({
      code: ERROR_CODE.VALIDATION_ERROR,
      message,
      details: fieldErrors,
    });
    this.name = "ValidationError";
  }
}

export const isAbortError = (error: unknown): boolean => {
  return error instanceof Error && error.name === "AbortError";
};
