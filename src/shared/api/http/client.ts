import ky, { Hooks, HTTPError, TimeoutError } from "ky";

import { isAbortError, ServerError } from "@/shared/api/errors";
import type { ApiResponse } from "@/shared/types/api";
import type { AuthStrategy } from "@/shared/types/auth";

export const createHttpClient = (authStrategy: AuthStrategy) => {
  const isServer = typeof window === "undefined";

  const hooks: Hooks = {
    // 1. 요청 전 토큰 주입
    beforeRequest: [
      async ({ request }) => {
        const token = await authStrategy.getAccessToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],

    // 2. 응답 직후 비즈니스 에러 체크 (200 OK 내의 success: false)
    afterResponse: [
      async ({ response }) => {
        if (response.ok) {
          const data = (await response.clone().json()) as ApiResponse<unknown>;

          if (!data.success) {
            throw new ServerError(data.error, data.meta);
          }
        }
      },
    ],

    // 3. HTTP 에러, 타임아웃, 네트워크 에러 통합 처리
    beforeError: [
      async ({ error }) => {
        // [중요] React Query의 요청 취소(Abort) 예외는 변형하지 않고 그대로 통과시킵니다.
        if (isAbortError(error)) return error;

        if (error instanceof ServerError) return error;

        if (error instanceof TimeoutError) {
          return new Error("요청 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.");
        }

        if (error.name === "HTTPError" && "response" in error) {
          const httpError = error as HTTPError;
          const status = httpError.response.status;

          // 401 Unauthorized 처리 (토큰 갱신 로직)
          if (status === 401) {
            if (isServer) {
              // 서버(SSR) 환경에서는 토큰 갱신 시도 자체를 원천 차단하고
              // 즉시 원본 에러를 반환하여 Middleware가 역할을 다하도록 유도합니다.
              return error;
            }

            // 클라이언트 환경에서만 갱신 로직 수행
            try {
              await authStrategy.refreshToken();
            } catch {
              authStrategy.onAuthError();
              return error;
            }
          }

          // 401 이외의 HTTP 에러 파싱
          try {
            const data = (await httpError.response.clone().json()) as ApiResponse<unknown>;
            if (!data.success) {
              return new ServerError(data.error, data.meta);
            }
          } catch {
            return new Error(`서버 오류가 발생했습니다. (${status})`);
          }
        }

        // Fetch Error (Network Error)
        if (!("response" in error) || error.response === undefined) {
          return new Error(
            "서버와 연결할 수 없습니다. 인터넷 연결 및 네트워크 상태를 확인해주세요.",
          );
        }

        return error;
      },
    ],
  };

  return ky.create({
    prefix: process.env.NEXT_PUBLIC_API_URL,
    timeout: 10000, // 10초 타임아웃
    hooks,
    // SSR 환경(서버)에서는 Silent Refresh를 안티패턴으로 규정했으므로 재시도를 수행하지 않습니다.
    // 클라이언트 환경에서만 401 에러에 대해 1회 재시도를 수행합니다.
    retry: !isServer
      ? {
          limit: 1,
          methods: ["get", "put", "delete", "post", "patch"], // GET, POST 등 대부분 갱신 후 재요청 유효함
          statusCodes: [401],
        }
      : { limit: 0 },
  });
};
