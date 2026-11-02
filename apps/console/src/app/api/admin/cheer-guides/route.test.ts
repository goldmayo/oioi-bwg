import { AppError } from "@oioi-bwg/server/errors/app-error";
import { beforeEach, expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());
vi.mock("@oioi-bwg/server/services/cheer-guide-service", () => ({ listAdminCheerGuides: list }));
vi.mock("@/server/auth/request-context", () => ({
  getRequestAuthorization: async () => ({ context: {} }),
}));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { GET } from "./route";

const request = () => new Request("http://localhost/api/admin/cheer-guides");
beforeEach(() => vi.clearAllMocks());
it("관리자 목록 계약을 검사하고 공유 캐시를 금지한다", async () => {
  list.mockResolvedValue({ items: [], nextCursor: null });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ items: [], nextCursor: null });
});
it.each([
  ["UNAUTHENTICATED", 401],
  ["FORBIDDEN", 403],
] as const)("%s 오류를 HTTP 경계에서 변환한다", async (code, status) => {
  list.mockRejectedValue(new AppError(code));
  expect((await GET(request())).status).toBe(status);
});
it("잘못된 출력 계약은 정상 목록으로 내보내지 않는다", async () => {
  list.mockResolvedValue({ items: [{ id: "invalid" }], nextCursor: null });
  expect((await GET(request())).status).toBe(500);
});
