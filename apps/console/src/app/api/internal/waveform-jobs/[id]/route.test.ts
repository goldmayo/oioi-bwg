import { AppError } from "@oioi-bwg/server/errors/app-error";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  get: vi.fn(),
  complete: vi.fn(),
  wake: vi.fn(),
  report: vi.fn(),
}));
vi.mock("@oioi-bwg/server/services/waveform-service", () => ({
  getRunnerWaveformJob: mock.get,
  completeWaveformJob: mock.complete,
}));
vi.mock("@/server/notifications/dispatcher", () => ({ wakeNotificationDispatcher: mock.wake }));
vi.mock("@/server/observability/server-error-reporter", () => ({ reportServerError: mock.report }));
import { GET } from "./route";
import { POST } from "./terminal/route";
const id = "019a0170-0000-7000-8000-000000000001";
const syntheticToken = "a".repeat(64);
const context = { params: Promise.resolve({ id }) };
const input = { jobId: id, attemptId: null, status: "FAILED", errorCode: "DLQ" };
const ack = { jobId: id, attemptId: null, status: "FAILED", applied: true };
function request(body?: BodyInit, headers?: HeadersInit) {
  const values = new Headers({
    authorization: `Bearer ${syntheticToken}`,
    "content-type": "application/json",
  });
  new Headers(headers).forEach((value, name) => values.set(name, value));
  return new Request(`http://127.0.0.1:3001/api/internal/waveform-jobs/${id}`, {
    method: body === undefined ? "GET" : "POST",
    body,
    headers: values,
    duplex: "half",
  } as RequestInit);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONSOLE_WAVEFORM_RUNNER_ENABLED", "true");
  vi.stubEnv("CONSOLE_WAVEFORM_RUNNER_TOKEN", syntheticToken);
  mock.get.mockResolvedValue({
    id,
    songId: id,
    videoId: "abcdefghijk",
    status: "QUEUED",
    attemptId: null,
    enqueuedAt: null,
  });
  mock.complete.mockResolvedValue(ack);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("기본 비활성·누락 설정·사용자 cookie·틀린 토큰은 본문/서비스에 접근하지 않는다", async () => {
  const req = request(JSON.stringify(input), {
    authorization: "",
    cookie: "authjs.session-token=synthetic",
  });
  const reader = vi.spyOn(req.body!, "getReader");
  vi.stubEnv("CONSOLE_WAVEFORM_RUNNER_ENABLED", undefined);
  const disabled = await POST(req, context);
  expect(disabled.status).toBe(403);
  expect(await disabled.json()).toMatchObject({ code: "FORBIDDEN" });
  vi.stubEnv("CONSOLE_WAVEFORM_RUNNER_ENABLED", "true");
  vi.stubEnv("CONSOLE_WAVEFORM_RUNNER_TOKEN", "");
  expect((await POST(req, context)).status).toBe(500);
  vi.stubEnv("CONSOLE_WAVEFORM_RUNNER_TOKEN", syntheticToken);
  vi.stubEnv("CONSOLE_AUTH_SECRET", syntheticToken);
  expect((await POST(req, context)).status).toBe(500);
  vi.stubEnv("CONSOLE_AUTH_SECRET", "test-only-auth");
  expect((await POST(req, context)).status).toBe(401);
  expect(
    (
      await POST(
        request(JSON.stringify(input), { authorization: `Bearer ${"b".repeat(64)}` }),
        context,
      )
    ).status,
  ).toBe(401);
  expect(reader).not.toHaveBeenCalled();
  expect(mock.get).not.toHaveBeenCalled();
  expect(mock.complete).not.toHaveBeenCalled();
  expect(mock.wake).not.toHaveBeenCalled();
});
it("조회는 최소 DTO만 반환하고 오류 응답도 캐시하지 않는다", async () => {
  const response = await GET(request(), context);
  expect(await response.json()).toEqual(await mock.get.mock.results[0]!.value);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect((await GET(request(), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  mock.get.mockRejectedValueOnce(new AppError("WAVEFORM_JOB_NOT_FOUND"));
  const missing = await GET(request(), context);
  expect(missing.status).toBe(404);
  expect(await missing.json()).toMatchObject({ code: "WAVEFORM_JOB_NOT_FOUND" });
  expect(missing.headers.get("Cache-Control")).toBe("no-store");
  expect((await GET(request(undefined, { origin: "https://example.test" }), context)).status).toBe(
    403,
  );
});
it("완료를 기존 adapter로 전달하고 무시된 결과에는 알림 발송을 깨우지 않는다", async () => {
  const response = await POST(request(JSON.stringify(input)), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(ack);
  expect(mock.complete).toHaveBeenCalledWith(input);
  expect(mock.wake).toHaveBeenCalledOnce();
  mock.complete.mockResolvedValueOnce({ ...ack, status: "SUCCEEDED", applied: false });
  expect((await POST(request(JSON.stringify(input)), context)).status).toBe(200);
  expect(mock.wake).toHaveBeenCalledOnce();
});
it("다른 경로의 jobId·잘못된 결과는 저장하지 않는다", async () => {
  for (const body of [
    { ...input, jobId: "019a0170-0000-7000-8000-000000000002" },
    { ...input, status: "SUCCEEDED", result: {} },
  ])
    expect((await POST(request(JSON.stringify(body)), context)).status).toBe(400);
  expect(mock.complete).not.toHaveBeenCalled();
});
it("JSON 형식·미디어 타입·선언 크기를 확인한다", async () => {
  expect((await POST(request("not json"), context)).status).toBe(400);
  expect((await POST(request("{}", { "content-type": "text/plain" }), context)).status).toBe(415);
  const req = request("{}", { "content-length": String(4 * 1024 * 1024 + 1) });
  const read = vi.spyOn(req.body!, "getReader");
  expect((await POST(req, context)).status).toBe(413);
  expect(read).not.toHaveBeenCalled();
  expect(mock.complete).not.toHaveBeenCalled();
});
it("거짓 Content-Length도 실제 byte 상한을 넘으면 취소한다", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1));
    },
    cancel,
  });
  expect((await POST(request(stream, { "content-length": "1" }), context)).status).toBe(413);
  expect(cancel).toHaveBeenCalledOnce();
  expect(mock.complete).not.toHaveBeenCalled();
});
it("끝나지 않는 본문을 10초 기한에 취소한다", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const pending = POST(request(new ReadableStream({ cancel })), context);
  await vi.advanceTimersByTimeAsync(10_000);
  expect((await pending).status).toBe(408);
  expect(cancel).toHaveBeenCalledOnce();
  expect(mock.complete).not.toHaveBeenCalled();
});
it("저장 실패는 오류 계약으로 응답하고 알림을 깨우지 않는다", async () => {
  mock.complete.mockRejectedValueOnce(new Error("storage unavailable"));
  const response = await POST(request(JSON.stringify(input)), context);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    code: "INTERNAL_SERVER_ERROR",
    message: "서버 오류가 발생했습니다.",
  });
  expect(mock.wake).not.toHaveBeenCalled();
});
