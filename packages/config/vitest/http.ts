import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

/** suite가 명시적으로 호출하는 HTTP 격리 설정. 도메인 fixture는 consumer가 소유한다. */
export function createHttpTestServer(baseUrl: string) {
  const server = setupServer();
  beforeAll(() => {
    // Node Request에 브라우저의 상대 URL 해석만 보충한다. 실제 Ky·fetch는 유지한다.
    vi.stubGlobal(
      "Request",
      class extends Request {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
          super(typeof input === "string" ? new URL(input, baseUrl) : input, init);
        }
      },
    );
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });
  afterAll(() => {
    server.close();
    vi.unstubAllGlobals();
  });
  return server;
}
