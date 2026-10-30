import { AppError } from "@oioi-bwg/server/errors/app-error";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  wake: vi.fn(),
  report: vi.fn(),
}));
vi.mock("@/server/auth/request-context", async () => ({
  ...(await import("@oioi-bwg/server/auth/request-context")),
  getRequestAuthorization: mocks.auth,
}));
vi.mock("@/server/notifications/dispatcher", () => ({ wakeNotificationDispatcher: mocks.wake }));
vi.mock("@oioi-bwg/server/services/waveform-service", () => ({
  getSongWaveform: mocks.get,
  importSongWaveform: mocks.upload,
}));
vi.mock("@/server/observability/server-error-reporter", () => ({
  reportServerError: mocks.report,
}));
import { GET, PUT } from "./route";
const id = "019a0170-0000-7000-8000-000000000001";
const request = new Request(`http://127.0.0.1:3001/api/admin/songs/${id}/waveform`);
const params = { params: Promise.resolve({ id }) };
const waveform = {
  durationMs: 20,
  bucketSizeMs: 20,
  generationVersion: 1,
  source: { type: "youtube", id: "abcdefghijk" },
  peaks: {
    version: 1,
    sample_rate: 24000,
    samples_per_pixel: 480,
    bits: 8,
    length: 1,
    data: [-2, 2],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ context: { user: { id }, ability: { cannot: () => false } } });
  mocks.get.mockResolvedValue(waveform);
});
it("검증한 JSON과 빈 결과를 no-store로 전달하며 UUID를 boundary에서 검증한다", async () => {
  const response = await GET(request, params);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual(waveform);
  mocks.get.mockResolvedValueOnce(null);
  expect(await (await GET(request, params)).json()).toBeNull();
  expect((await GET(request, { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect(mocks.get).toHaveBeenCalledTimes(2);
});
it("권한 거부와 없는 곡을 공통 오류로 반환한다", async () => {
  for (const [code, status] of [
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["SONG_NOT_FOUND", 404],
  ] as const) {
    mocks.get.mockRejectedValueOnce(new AppError(code));
    expect((await GET(request, params)).status).toBe(status);
  }
});
it("저장된 JSON의 output contract 위반은 500이며 원시 데이터를 노출하지 않는다", async () => {
  mocks.get.mockResolvedValueOnce({ ...waveform, peaks: { ...waveform.peaks, data: [2, -2] } });
  const response = await GET(request, params);
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("sample_rate");
  expect(mocks.report).toHaveBeenCalledOnce();
});

const job = {
  id,
  songId: id,
  videoId: "abcdefghijk",
  status: "SUCCEEDED",
  errorCode: null,
  createdAt: "2026-10-31T00:00:00Z",
  finishedAt: "2026-10-31T00:00:00Z",
  editorHref: "/admin/edit/test",
};
function upload(body = JSON.stringify(waveform), headers: Record<string, string> = {}) {
  return new Request(request.url, {
    method: "PUT",
    headers: { origin: "http://127.0.0.1:3001", "content-type": "application/json", ...headers },
    body,
  });
}
it("관리자 업로드는 기존 DTO를 검증하고 commit 후 dispatcher를 깨운다", async () => {
  mocks.upload.mockResolvedValue(job);
  const response = await PUT(upload(), params);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual(job);
  expect(mocks.upload).toHaveBeenCalledWith(expect.anything(), id, waveform);
  expect(mocks.wake).toHaveBeenCalledOnce();
});
it("인증·Origin·실제 크기·형식 실패는 저장·알림 전에 거절한다", async () => {
  mocks.auth.mockResolvedValueOnce({ context: { user: null } });
  expect((await PUT(upload(), params)).status).toBe(401);
  mocks.auth.mockResolvedValueOnce({ context: { user: { id }, ability: { cannot: () => true } } });
  expect((await PUT(upload(), params)).status).toBe(403);
  expect((await PUT(upload(undefined, { origin: "https://other.test" }), params)).status).toBe(403);
  expect((await PUT(upload(" ".repeat(4 * 1024 * 1024 + 1)), params)).status).toBe(413);
  expect((await PUT(upload("{}", { "content-length": "99999999" }), params)).status).toBe(413);
  for (const body of [
    "broken",
    "{}",
    JSON.stringify({ ...waveform, peaks: { ...waveform.peaks, data: [2, -2] } }),
  ])
    expect((await PUT(upload(body), params)).status).toBe(400);
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.wake).not.toHaveBeenCalled();
});
