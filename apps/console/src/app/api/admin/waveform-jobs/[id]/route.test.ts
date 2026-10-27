import { AppError } from "@oioi-bwg/server/errors/app-error";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), report: vi.fn() }));
vi.mock("@/server/auth/request-context", () => ({ getRequestAuthorization: mocks.auth }));
vi.mock("@oioi-bwg/server/services/waveform-service", () => ({ getWaveformJob: mocks.get }));
vi.mock("@/server/observability/server-error-reporter", () => ({
  reportServerError: mocks.report,
}));
import { GET } from "./route";
const id = "019a0170-0000-7000-8000-000000000001";
const request = new Request(`http://127.0.0.1:3001/api/admin/waveform-jobs/${id}`);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ context: { user: { id } } });
  mocks.get.mockResolvedValue({
    id,
    songId: id,
    videoId: "abcdefghijk",
    status: "SUCCEEDED",
    errorCode: null,
    createdAt: "2026-10-27T00:00:00.000Z",
    finishedAt: "2026-10-27T00:00:01.000Z",
    editorHref: "/admin/edit/song",
  });
});
it("UUID와 결과 DTO를 검사하고 개인 상태 응답을 캐시하지 않는다", async () => {
  const response = await GET(request, { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const invalid = await GET(request, { params: Promise.resolve({ id: "bad" }) });
  expect(invalid.status).toBe(400);
  expect(mocks.get).toHaveBeenCalledOnce();
});
it("권한 거부와 삭제된 작업을 공통 오류로 변환한다", async () => {
  for (const [code, status] of [
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["WAVEFORM_JOB_NOT_FOUND", 404],
  ] as const) {
    mocks.get.mockRejectedValueOnce(new AppError(code));
    expect((await GET(request, { params: Promise.resolve({ id }) })).status).toBe(status);
  }
});
