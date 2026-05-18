declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: { errorMessage?: string; suppressErrorToast?: boolean };
    mutationMeta: { errorMessage?: string; suppressErrorToast?: boolean };
  }
}

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ServerError } from "@/shared/api/errors";
// import { logger } from "@/shared/utils/sentry";

export interface QueryClientConfig {
  /**
   * UI 의존성(sonner 등)을 분리하기 위한 콜백 함수입니다.
   * 전역 에러 발생 시 사용자에게 토스트 알림을 띄우는 역할을 합니다.
   */
  notifyErrorToast: (message: string) => void;
}

export type ErrorNotifier = QueryClientConfig["notifyErrorToast"];

const createGlobalErrorHandler = (notifyErrorToast: ErrorNotifier) => {
  return (error: unknown, meta?: Record<string, unknown>) => {
    // 1. 에러 토스트 무시 플래그 (조용히 넘어가고 싶을 때)
    if (meta?.suppressErrorToast) return;

    const customMessage = typeof meta?.errorMessage === "string" ? meta.errorMessage : undefined;

    // 2. 서버에서 내려준 비즈니스 에러 (ServerError)
    if (error instanceof ServerError) {
      notifyErrorToast(customMessage || `[${error.code}] ${error.message}`);
      return;
    }

    // 3. 클라이언트 네트워크 에러 등 (진짜 에러/버그)
    if (error instanceof Error) {
      // TODO: Sentry 연계 시 logger.error(error, { ...meta, customMessage })를 활성화합니다.
      notifyErrorToast(customMessage || error.message);
      return;
    }

    // 4. 아주 예외적인 알 수 없는 에러
    // TODO: Sentry 연계 시 logger.error(new Error("Unknown Error"), { ...meta, originalError: error })를 활성화합니다.
    notifyErrorToast(customMessage || "알 수 없는 오류가 발생했습니다.");
  };
};

export const makeQueryClient = ({ notifyErrorToast }: QueryClientConfig) => {
  const handleGlobalError = createGlobalErrorHandler(notifyErrorToast);

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // 이미 데이터가 있는데 백그라운드 리패칭하다 실패한 거면 유저 방해 안 함
        if (query.state.data !== undefined) return;

        handleGlobalError(error, query.meta);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        handleGlobalError(error, mutation.meta);
      },
    }),
    defaultOptions: {
      queries: {
        retry: 0,
        throwOnError: true, // 조회(GET) 실패는 ErrorBoundary로 던져서 화면 덮기
        refetchOnWindowFocus: false,
      },
      mutations: {
        throwOnError: false, // 변경(POST) 실패는 전역 핸들러에서 Toast만 띄우기
      },
    },
  });
};
