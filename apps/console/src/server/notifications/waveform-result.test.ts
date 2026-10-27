import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ complete: vi.fn(), wake: vi.fn() }));
vi.mock("@oioi-bwg/server/services/waveform-service", () => ({
  completeWaveformJob: mock.complete,
}));
vi.mock("./dispatcher", () => ({ wakeNotificationDispatcher: mock.wake }));
import { acceptWaveformResult } from "./waveform-result";
const input = {
  jobId: "019a0170-0000-7000-8000-000000000001",
  attemptId: null,
  status: "FAILED",
  errorCode: "DLQ",
};
beforeEach(() => vi.clearAllMocks());
it("결과 commit을 기다린 뒤에만 발송을 깨우고 실패·중복에는 깨우지 않는다", async () => {
  let done!: (value: { applied: boolean }) => void;
  mock.complete.mockReturnValueOnce(
    new Promise((resolve) => {
      done = resolve;
    }),
  );
  const pending = acceptWaveformResult(input);
  expect(mock.wake).not.toHaveBeenCalled();
  done({ applied: true });
  await pending;
  expect(mock.wake).toHaveBeenCalledOnce();
  mock.complete.mockResolvedValueOnce({ applied: false });
  await acceptWaveformResult(input);
  expect(mock.wake).toHaveBeenCalledOnce();
  mock.complete.mockRejectedValueOnce(new Error("rollback"));
  await expect(acceptWaveformResult(input)).rejects.toThrow("rollback");
  expect(mock.wake).toHaveBeenCalledOnce();
});
it("입력 계약 위반은 서비스에 전달하지 않는다", async () => {
  await expect(acceptWaveformResult({})).rejects.toThrow();
  expect(mock.complete).not.toHaveBeenCalled();
});
