import {
  ApiError,
  ApiErrorResponse,
  ApiMetadata,
  ApiSuccessResponse,
  CursorPaginatedData,
  OffsetPaginatedData,
} from "@/shared/types/api";

/**
 * 응답에 포함될 공통 메타데이터 생성 유틸리티 (내부용)
 */
const getMetadata = (path?: string): ApiMetadata => ({
  timestamp: new Date().toISOString(),
  requestId: crypto.randomUUID(),
  path,
});

/**
 * [구현체] 성공 응답 클래스
 */
export class SuccessResponse<T> implements ApiSuccessResponse<T> {
  public readonly success = true as const;
  public meta: ApiMetadata;

  constructor(
    public data: T,
    path?: string,
  ) {
    this.meta = getMetadata(path);
  }
}

/**
 * [구현체] 에러 응답 클래스
 */
export class ErrorResponse implements ApiErrorResponse {
  public readonly success = false as const;
  public meta: ApiMetadata;
  public error: ApiError;

  constructor(error: ApiError, path?: string) {
    this.error = error;
    this.meta = getMetadata(path);
  }
}

/**
 * [구현체] Offset 기반 페이징 성공 응답 클래스
 */
export class OffsetPaginatedResponse<T> extends SuccessResponse<OffsetPaginatedData<T>> {
  constructor(data: OffsetPaginatedData<T>, path?: string) {
    super(data, path);
  }
}

/**
 * [구현체] Cursor 기반 페이징 성공 응답 클래스
 */
export class CursorPaginatedResponse<T> extends SuccessResponse<CursorPaginatedData<T>> {
  constructor(data: CursorPaginatedData<T>, path?: string) {
    super(data, path);
  }
}
