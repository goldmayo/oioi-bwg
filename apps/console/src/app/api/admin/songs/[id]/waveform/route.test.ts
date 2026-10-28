import { AppError } from "@oioi-bwg/server/errors/app-error";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), report: vi.fn() }));
vi.mock("@/server/auth/request-context", () => ({ getRequestAuthorization: mocks.auth }));
vi.mock("@oioi-bwg/server/services/waveform-service", () => ({ getSongWaveform: mocks.get }));
vi.mock("@/server/observability/server-error-reporter", () => ({
  reportServerError: mocks.report,
}));
import { GET } from "./route";
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
  mocks.auth.mockResolvedValue({ context: { user: { id } } });
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
