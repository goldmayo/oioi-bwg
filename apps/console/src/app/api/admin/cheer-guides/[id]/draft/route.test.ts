// @vitest-environment node

import { AppError } from "@oioi-bwg/server/errors/app-error";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const read = vi.hoisted(() => vi.fn());
const save = vi.hoisted(() => vi.fn());
vi.mock("@oioi-bwg/server/services/cheer-guide-draft-service", () => ({
  getAdminCheerGuideEditor: read,
  saveAdminCheerGuideDraft: save,
}));
vi.mock("@/server/auth/request-context", () => ({
  getRequestAuthorization: async () => ({ context: {} }),
}));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));
import { GET, PATCH } from "./route";
const id = "019a0170-0000-7000-8000-000000000001";
const context = { params: Promise.resolve({ id }) };
const request = (input: unknown, origin = "http://127.0.0.1:3001") =>
  new Request("http://127.0.0.1:3001/api/admin/cheer-guides/" + id + "/draft", {
    method: "PATCH",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(input),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONSOLE_ORIGIN", "http://127.0.0.1:3001");
});
afterEach(() => vi.unstubAllEnvs());
it("작업본의 출력 계약을 검증하고 공유 캐시를 금지한다", async () => {
  read.mockResolvedValue({
    id,
    mode: "CONCERT",
    lockVersion: 1,
    song: { id, title: "곡", albumName: "앨범", currentYoutubeId: "video" },
    referenceYoutubeId: "video",
    lyrics: [],
  });
  const response = await GET(new Request("http://localhost"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  read.mockResolvedValue({ id });
  expect((await GET(new Request("http://localhost"), context)).status).toBe(500);
});
it("lyrics와 expected version만 받아 다음 버전을 반환한다", async () => {
  save.mockResolvedValue({ id, lockVersion: 2 });
  const response = await PATCH(request({ lyrics: [], expectedLockVersion: 1 }), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id, lockVersion: 2 });
  expect(
    (await PATCH(request({ lyrics: [], expectedLockVersion: 1, isPublished: true }), context))
      .status,
  ).toBe(400);
  expect(
    (await PATCH(request({ lyrics: [], expectedLockVersion: 1 }, "https://other.invalid"), context))
      .status,
  ).toBe(403);
  expect(save).toHaveBeenCalledTimes(1);
});
it.each([
  ["CHEER_GUIDE_CONFLICT", 409],
  ["CHEER_GUIDE_NOT_FOUND", 404],
  ["UNAUTHENTICATED", 401],
  ["FORBIDDEN", 403],
] as const)("%s를 변환한다", async (code, status) => {
  save.mockRejectedValue(new AppError(code));
  expect((await PATCH(request({ lyrics: [], expectedLockVersion: 1 }), context)).status).toBe(
    status,
  );
});
