import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), report: vi.fn(), sender: vi.fn() }));
vi.mock("@oioi-bwg/server/services/notification-delivery-service", () => ({
  dispatchNotifications: mocks.dispatch,
}));
vi.mock("@/server/observability/server-error-reporter", () => ({
  reportServerError: mocks.report,
}));
vi.mock("./fcm", () => ({ createFcmSender: () => mocks.sender }));
import { startNotificationDispatcher, wakeNotificationDispatcher } from "./dispatcher";

const state = globalThis as typeof globalThis & { __oioiNotificationDispatcher?: unknown };
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  delete state.__oioiNotificationDispatcher;
  mocks.dispatch.mockResolvedValue(0);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  delete state.__oioiNotificationDispatcher;
});
test("서버 부팅 중복 호출에도 한 루프만 실행하고 60초마다 복구한다", async () => {
  startNotificationDispatcher();
  startNotificationDispatcher();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.dispatch).toHaveBeenCalledTimes(2);
});
test("여러 번 깨워도 중첩 발송하지 않고 실패 후 루프가 복구된다", async () => {
  mocks.dispatch.mockRejectedValueOnce(new Error("database unavailable"));
  startNotificationDispatcher();
  wakeNotificationDispatcher();
  wakeNotificationDispatcher();
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  expect(mocks.report).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.dispatch).toHaveBeenCalledTimes(2);
});
