// types/api.ts

// =========================================================
// 1. 공통 메타데이터 (모든 응답에 포함)
// =========================================================
export interface ApiMetadata {
  timestamp: string; // 응답 시간 (ISO 8601 포맷)
  requestId: string; // 분산 환경 로깅 및 추적용 Trace ID (UUID)
  path?: string; // 요청된 API 엔드포인트
  // eventId?: string; // Sentry 이벤트 ID (에러 추적용, 필요 시 주석 해제)
}

// =========================================================
// 2. 상세 에러 규격
// =========================================================
export interface FieldError {
  field: string; // 에러가 발생한 필드명 (ex: 'email', 'password')
  value?: unknown; // 클라이언트가 전송했던 잘못된 값
  reason: string; // 상세 에러 사유 (ex: '이메일 형식이 올바르지 않습니다.')
}

export interface ApiError {
  code: string; // 비즈니스 에러 코드 (ex: 'USER_NOT_FOUND', 'INVALID_INPUT')
  message: string; // 클라이언트에게 노출할 (또는 로깅할) 에러 메시지
  details?: FieldError[]; // 폼 유효성 검사 실패 시 필드별 에러 상세 정보
}

// =========================================================
// 3. API 응답 규격 (Discriminated Union 활용)
// =========================================================

// 3-1. 성공 응답
export interface ApiSuccessResponse<T = void> {
  success: true; // 타입 가드를 위한 리터럴 타입
  data: T; // 성공 시 무조건 존재함
  meta: ApiMetadata; // 공통 메타데이터
}

// 3-2. 실패 응답
export interface ApiErrorResponse {
  success: false; // 타입 가드를 위한 리터럴 타입
  error: ApiError; // 실패 시 data 대신 error 객체가 무조건 존재함
  meta: ApiMetadata; // 공통 메타데이터
}

// 3-3. 통합 API 응답 (이 타입을 Axios나 Fetch의 제네릭으로 사용)
export type ApiResponse<T = void> = ApiSuccessResponse<T> | ApiErrorResponse;

// =========================================================
// 4. 페이징 규격 (Offset vs Cursor)
// =========================================================
export interface OffsetPageInfo {
  currentPage: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface OffsetPaginatedData<T> {
  items: T[];
  pageInfo: OffsetPageInfo;
}

export interface CursorPageInfo {
  nextCursor: string | number | null;
  hasNext: boolean;
}

export interface CursorPaginatedData<T> {
  items: T[];
  pageInfo: CursorPageInfo;
}
