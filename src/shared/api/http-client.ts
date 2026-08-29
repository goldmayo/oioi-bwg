import "client-only";

import type { Options, ResponsePromise } from "ky";
import ky from "ky";

import { normalizeHttpError } from "./http-errors";

/**
 * 이 애플리케이션의 JSON Route Handler API를 위한 브라우저 전송 계층이다.
 *
 * Query 재시도는 TanStack Query가 소유한다. 엔드포인트별 전송 재시도는 호출 지점에서
 * 멱등성을 명시적으로 판단한 경우에만 추가한다.
 */
const client = ky.create({
  credentials: "same-origin",
  retry: { limit: 0 },
  timeout: 10_000,
});

/**
 * Ky의 non-2xx 거부 동작은 유지하되, 애플리케이션 오류 경계에는 원시 HTTPError 대신
 * ApiError가 전달되도록 한다.
 */
async function requestJson(request: ResponsePromise): Promise<unknown> {
  try {
    return await request.json<unknown>();
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

/**
 * JSON Route Handler 전송 객체. 성공 payload는 항상 unknown으로 반환하므로 entity API가
 * 해당 response contract로 검증해야 한다.
 */
export const http = {
  get: (url: string, options?: Options) => requestJson(client.get(url, options)),
  post: (url: string, options?: Options) => requestJson(client.post(url, options)),
  put: (url: string, options?: Options) => requestJson(client.put(url, options)),
  patch: (url: string, options?: Options) => requestJson(client.patch(url, options)),
  delete: (url: string, options?: Options) => requestJson(client.delete(url, options)),
};
