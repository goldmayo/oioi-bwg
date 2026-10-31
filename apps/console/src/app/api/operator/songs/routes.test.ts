import { AppError } from "@oioi-bwg/server/errors/app-error";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  resolve: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  wake: vi.fn(),
  report: vi.fn(),
}));
vi.mock("@oioi-bwg/server/services/operator-auth-service", () => ({
  authorizeOperatorToken: mocks.auth,
}));
vi.mock("@oioi-bwg/server/services/operator-song-service", () => ({
  resolveOperatorSongs: mocks.resolve,
}));
vi.mock("@oioi-bwg/server/services/waveform-service", () => ({
  getSongWaveform: mocks.get,
  importSongWaveform: mocks.save,
}));
vi.mock("@/server/notifications/dispatcher", () => ({ wakeNotificationDispatcher: mocks.wake }));
vi.mock("@/server/observability/server-error-reporter", () => ({
  reportServerError: mocks.report,
}));
import { GET, PUT } from "./[id]/waveform/route";
import { POST } from "./resolve/route";
const id = "019a0170-0000-7000-8000-000000000001";
const token = "oioi_" + "a".repeat(64);
const videoId = "9yfrVqCcrS0";
const context = { user: { id }, ability: { cannot: () => false } };
const params = { params: Promise.resolve({ id }) };
const data = {
  durationMs: 40,
  bucketSizeMs: 20,
  peaks: {
    version: 2,
    channels: 1,
    sample_rate: 24000,
    samples_per_pixel: 480,
    bits: 8,
    length: 2,
    data: [-20, 20, -10, 10],
  },
  source: { type: "youtube", id: videoId },
  generationVersion: 1,
};
const job = {
  id,
  songId: id,
  videoId,
  status: "SUCCEEDED",
  errorCode: null,
  createdAt: "2026-10-31T00:00:00Z",
  finishedAt: "2026-10-31T00:00:00Z",
  editorHref: "/admin/edit/clear",
};
function request(method: string, body?: unknown, extra: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3001/api/operator/songs/resolve", {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CONSOLE_OPERATOR_ENABLED", "true");
  mocks.auth.mockResolvedValue({ context });
  mocks.resolve.mockResolvedValue({
    items: [
      {
        videoId,
        status: "matched",
        songId: id,
        title: "내 이름 맑음",
        editorHref: "/admin/edit/clear",
      },
    ],
  });
  mocks.get.mockResolvedValue(data);
  mocks.save.mockResolvedValue(job);
});
afterEach(() => vi.unstubAllEnvs());
it("모든 곡 경계는 기본 비활성이고 cookie·Origin을 bearer로 대체하지 않는다", async () => {
  const calls = [
    (r: Request) => POST(r),
    (r: Request) => GET(r, params),
    (r: Request) => PUT(r, params),
  ];
  vi.stubEnv("CONSOLE_OPERATOR_ENABLED", "false");
  for (const call of calls) expect((await call(request("POST", {}))).status).toBe(403);
  vi.stubEnv("CONSOLE_OPERATOR_ENABLED", "true");
  for (const call of calls) {
    expect((await call(request("POST", {}, { cookie: "session=x" }))).status).toBe(403);
    expect((await call(request("POST", {}, { origin: "http://127.0.0.1:3001" }))).status).toBe(403);
    expect((await call(request("POST", {}, { authorization: "" }))).status).toBe(401);
  }
  expect(mocks.auth).not.toHaveBeenCalled();
  for (const mock of [mocks.resolve, mocks.get, mocks.save]) expect(mock).not.toHaveBeenCalled();
});
it("매 요청의 현재 계정·MFA token 인가가 본문과 서비스보다 먼저다", async () => {
  mocks.auth.mockRejectedValue(new AppError("UNAUTHENTICATED"));
  for (const call of [
    (r: Request) => POST(r),
    (r: Request) => GET(r, params),
    (r: Request) => PUT(r, params),
  ]) {
    const response = await call(request("POST", "x".repeat(20000)));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("조회 batch는 정확한 ID·중복 없음·500곡·16KiB의 strict body로 제한한다", async () => {
  for (const body of [
    { videoIds: [] },
    { videoIds: ["https://youtu.be/9yfrVqCcrS0"] },
    { videoIds: [videoId, videoId] },
    { videoIds: [videoId], command: "anything" },
    { videoIds: Array.from({ length: 501 }, (_, i) => "video" + String(i).padStart(6, "0")) },
  ])
    expect((await POST(request("POST", body))).status).toBe(400);
  expect((await POST(request("POST", "x".repeat(16384)))).status).toBe(413);
  expect(mocks.resolve).not.toHaveBeenCalled();
  const response = await POST(request("POST", { videoIds: [videoId] }));
  expect(response.status).toBe(200);
  expect((await response.json()).items[0].songId).toBe(id);
  expect(mocks.resolve).toHaveBeenCalledWith(context, [videoId]);
});
it("파형 부재는 null이며 잘못된 곡 ID는 service 전에 거절한다", async () => {
  mocks.get.mockResolvedValueOnce(null);
  const response = await GET(request("GET"), params);
  expect(await response.json()).toBeNull();
  expect(response.headers.get("cache-control")).toBe("no-store");
  mocks.get.mockClear();
  expect((await GET(request("GET"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect(mocks.get).not.toHaveBeenCalled();
});
it("기존 파형 계약으로 등록하고 commit 성공 뒤에만 알림 전달을 깨운다", async () => {
  expect((await PUT(request("PUT", { ...data, generationVersion: 2 }), params)).status).toBe(400);
  expect((await PUT(request("PUT", "x".repeat(4 * 1024 * 1024)), params)).status).toBe(413);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.wake).not.toHaveBeenCalled();
  const response = await PUT(request("PUT", data), params);
  expect(await response.json()).toEqual(job);
  expect(mocks.save).toHaveBeenCalledWith(context, id, data, { replaceExisting: false });
  expect(mocks.wake).toHaveBeenCalledOnce();
  mocks.wake.mockClear();
  mocks.save.mockRejectedValueOnce(new AppError("WAVEFORM_SOURCE_INVALID"));
  expect((await PUT(request("PUT", data), params)).status).toBe(400);
  expect(mocks.wake).not.toHaveBeenCalled();
});
it("서버 결과 계약 위반은 원문을 노출하지 않고 보고한다", async () => {
  mocks.resolve.mockResolvedValue({
    items: [{ videoId, status: "matched", secret: "private-db-secret" }],
  });
  const response = await POST(request("POST", { videoIds: [videoId] }));
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private-db-secret");
  expect(mocks.report).toHaveBeenCalledOnce();
});

it("operator는 명시한 replace만 교체하고 경합한 기존 파형은 409로 보존한다", async () => {
  expect(
    (await PUT(request("PUT", data, { "x-oioi-waveform-write-mode": "unknown" }), params)).status,
  ).toBe(400);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(
    (await PUT(request("PUT", data, { "x-oioi-waveform-write-mode": "replace" }), params)).status,
  ).toBe(200);
  expect(mocks.save).toHaveBeenCalledWith(context, id, data, { replaceExisting: true });
  mocks.wake.mockClear();
  mocks.save.mockRejectedValueOnce(new AppError("WAVEFORM_ALREADY_EXISTS"));
  const response = await PUT(request("PUT", data), params);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "WAVEFORM_ALREADY_EXISTS" });
  expect(mocks.wake).not.toHaveBeenCalled();
});
