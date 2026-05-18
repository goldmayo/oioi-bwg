import "server-only";

import { ERROR_CODE, ServerError } from "@/shared/api/errors";
import { ErrorResponse, SuccessResponse } from "@/shared/api/response";
import { ApiResponse } from "@/shared/types/api";

/**
 * [문지기] 모든 서비스/DB 호출을 ApiResponse 규격으로 안전하게 래핑합니다.
 * 에러 발생 시 ServerError 객체가 제공하는 정보를 바탕으로 규격화된 응답을 생성합니다.
 */
export async function withApiResponse<T>({
  action,
  path,
}: {
  action: () => Promise<T>;
  path?: string;
}): Promise<ApiResponse<T>> {
  try {
    const data = await action();
    return new SuccessResponse(data, path);
  } catch (error) {
    console.error("[API Error Handler]:", error);

    // 1. ServerError인 경우 객체가 스스로를 증명(toApiError)하도록 함
    if (error instanceof ServerError) {
      return new ErrorResponse(error.toApiError(), path);
    }

    // 2. 예기치 못한 에러인 경우 기본 에러 응답 생성
    // TODO: Sentry 연계 시 logger.error(error, { path })를 호출하고
    // 반환된 eventId를 ApiMetadata에 포함하여 클라이언트에 전달하는 로직을 추가할 예정입니다.
    return new ErrorResponse(
      {
        code: ERROR_CODE.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : "알 수 없는 서버 오류가 발생했습니다.",
      },
      path,
    );
  }
}

/**
 * [헬퍼] ApiResponse의 결과가 성공이면 데이터를 반환하고, 실패면 ServerError를 던집니다.
 * TanStack Query의 mutationFn이나 서버 컴포넌트에서 결과를 간단히 처리할 때 사용합니다.
 */
export function ensureSuccess<T>(response: ApiResponse<T>): T {
  if (response.success) {
    return response.data;
  }

  // 비즈니스 에러인 경우 ServerError로 승격시켜 throw
  throw new ServerError(response.error, response.meta);
}

/**
 * 
 * Service:
ts
const result = SongSchema.safeParse(data);
if (!result.success) throw new ValidationError(mapZodToFieldErrors(result.error));
문지기(Action):
ts
} catch (error) {
  if (error instanceof ServerError) return new ErrorResponse(error.toApiError(), path);
  // ...
}
 */
