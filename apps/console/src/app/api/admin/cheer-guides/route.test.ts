// @vitest-environment node

import { AppError } from "@oioi-bwg/server/errors/app-error";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
vi.mock("@oioi-bwg/server/services/cheer-guide-service", () => ({
  listAdminCheerGuides: list,
  createAdminCheerGuide: create,
}));
vi.mock("@/server/auth/request-context", () => ({
  getRequestAuthorization: async () => ({ context: {} }),
}));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { GET, POST } from "./route";

const request = () => new Request("http://localhost/api/admin/cheer-guides");
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONSOLE_ORIGIN", "http://localhost");
});
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

afterEach(() => vi.unstubAllEnvs());

const id = "019a0170-0000-7000-8000-000000000001";
const input = {
  songId: id,
  mode: "CONCERT",
  sourceType: "FANDOM",
  sourceUrl: null,
  guideVideoUrl: null,
  description: null,
};
function post(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/admin/cheer-guides", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
it("비공개 추가의 결과 ID만 201로 반환하며 공유 캐시를 금지한다", async () => {
  create.mockResolvedValue({ id });
  const response = await POST(post(input));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ id });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("임의 공개·작성자 입력과 다른 Origin을 거절한다", async () => {
  expect((await POST(post({ ...input, isPublished: true, createdByAccountId: id }))).status).toBe(
    400,
  );
  expect((await POST(post(input, "https://other.invalid"))).status).toBe(403);
  expect(create).not.toHaveBeenCalled();
});
it.each([
  ["CHEER_GUIDE_ALREADY_EXISTS", 409],
  ["SONG_NOT_FOUND", 404],
  ["FORBIDDEN", 403],
] as const)("추가의 %s 오류를 변환한다", async (code, status) => {
  create.mockRejectedValue(new AppError(code));
  expect((await POST(post(input))).status).toBe(status);
});
