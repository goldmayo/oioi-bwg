import { AppError } from "@oioi-bwg/server/errors/app-error";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  request: vi.fn(),
  enqueue: vi.fn(),
  terminal: vi.fn(),
  report: vi.fn(),
}));
vi.mock("@/server/auth/request-context", async () => ({
  ...(await import("@oioi-bwg/server/auth/request-context")),
  getRequestAuthorization: mocks.auth,
}));
vi.mock("@oioi-bwg/server/services/waveform-service", () => ({
  requestWaveformJob: mocks.request,
}));
vi.mock("@/server/waveform/enqueue", () => ({ enqueueWaveform: mocks.enqueue }));
vi.mock("@/server/notifications/waveform-result", () => ({ acceptWaveformResult: mocks.terminal }));
vi.mock("@/server/observability/server-error-reporter", () => ({
  reportServerError: mocks.report,
}));
import { POST } from "./route";
const id = "019a0170-0000-7000-8000-000000000001";
const job = { id, songId: id, videoId: "abcdefghijk" };
const context = { user: { id }, ability: { cannot: () => false } };
function request(body: unknown = { songId: id }, origin = "http://127.0.0.1:3001") {
  return new Request("http://127.0.0.1:3001/api/admin/waveform-jobs", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONSOLE_WAVEFORM_GENERATION_ENABLED", "true");
  vi.stubEnv("CONSOLE_WAVEFORM_RUNNER_ENABLED", "true");
  vi.stubEnv("CONSOLE_WAVEFORM_ALLOWED_VIDEO_IDS", job.videoId);
  mocks.auth.mockResolvedValue({ context });
  mocks.request.mockResolvedValue({ job, created: true });
  mocks.enqueue.mockResolvedValue("ENQUEUED");
  mocks.terminal.mockResolvedValue({ applied: true });
});
afterEach(() => vi.unstubAllEnvs());
it.each(["CONSOLE_WAVEFORM_GENERATION_ENABLED", "CONSOLE_WAVEFORM_RUNNER_ENABLED"])(
  "%s는 누락·오타일 때 인증·본문·DB·socket 전에 닫힌다",
  async (key) => {
    for (const value of ["", "TRUE", "false"]) {
      vi.stubEnv(key, value);
      expect((await POST(request())).status).toBe(403);
    }
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  },
);
it("ADMIN/MFA와 Origin·strict 본문을 검사한 뒤에만 생성한다", async () => {
  mocks.auth.mockResolvedValueOnce({ context: { ...context, user: null } });
  expect((await POST(request())).status).toBe(401);
  mocks.auth.mockResolvedValueOnce({ context: { ...context, ability: { cannot: () => true } } });
  expect((await POST(request())).status).toBe(403);
  expect((await POST(request(undefined, "https://other.test"))).status).toBe(403);
  for (const body of [{ songId: "bad" }, { songId: id, videoId: job.videoId }])
    expect((await POST(request(body))).status).toBe(400);
  expect(mocks.request).not.toHaveBeenCalled();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});
it.each(["", "abcdefghijk,bad", " abcdefghijk"])(
  "미승인·잘못된 목록 %s는 빈 승인 목록을 전달한다",
  async (ids) => {
    vi.stubEnv("CONSOLE_WAVEFORM_ALLOWED_VIDEO_IDS", ids);
    mocks.request.mockRejectedValueOnce(new AppError("FORBIDDEN"));
    expect((await POST(request())).status).toBe(403);
    expect(mocks.request).toHaveBeenCalledWith(context, id, []);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  },
);
it.each(["ENQUEUED", "UNCONFIRMED"])(
  "%s는 같은 jobId의 202이며 재요청은 socket을 다시 호출하지 않는다",
  async (outcome) => {
    mocks.enqueue.mockResolvedValueOnce(outcome);
    for (let i = 0; i < 2; i++) {
      const response = await POST(request());
      expect(response.status).toBe(202);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ jobId: id });
      mocks.request.mockResolvedValue({ job, created: false });
    }
    expect(mocks.enqueue).toHaveBeenCalledExactlyOnceWith({
      jobId: id,
      songId: id,
      videoId: job.videoId,
    });
    expect(mocks.terminal).not.toHaveBeenCalled();
  },
);
it.each([true, false])(
  "확정 미전달의 조건부 terminal 적용=%s일 때만 503을 반환한다",
  async (applied) => {
    mocks.enqueue.mockResolvedValueOnce("NOT_ENQUEUED");
    mocks.terminal.mockResolvedValueOnce({ applied });
    const response = await POST(request());
    expect(response.status).toBe(applied ? 503 : 202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.terminal).toHaveBeenCalledExactlyOnceWith({
      jobId: id,
      attemptId: null,
      status: "FAILED",
      errorCode: "ENQUEUE_FAILED",
    });
    if (applied) expect(await response.json()).toMatchObject({ code: "ENQUEUE_FAILED" });
  },
);
