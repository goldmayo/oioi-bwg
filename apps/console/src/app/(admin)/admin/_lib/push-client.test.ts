import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { connectPush } from "./push-client";
const sdk = vi.hoisted(() => {
  let registered: (fid: string) => void = () => {};
  const offRegistered = vi.fn();
  const offMessage = vi.fn();
  return {
    offRegistered,
    offMessage,
    app: vi.fn(() => ({ name: "oioi-console-push" })),
    apps: vi.fn(() => []),
    getMessaging: vi.fn(() => ({})),
    isSupported: vi.fn(async () => true),
    onMessage: vi.fn(() => offMessage),
    onRegistered: vi.fn((_messaging: unknown, callback: (fid: string) => void) => {
      registered = callback;
      return offRegistered;
    }),
    register: vi.fn(async () => {
      registered("c1234567890123456789012");
    }),
  };
});
vi.mock("firebase/app", () => ({ initializeApp: sdk.app, getApps: sdk.apps, deleteApp: vi.fn() }));
vi.mock("firebase/messaging", () => sdk);
const config = {
  apiKey: "public",
  appId: "app",
  projectId: "test-project",
  messagingSenderId: "123",
  vapidKey: "B".repeat(87),
};
const worker = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("Notification", { permission: "granted" });
  worker.mockResolvedValue({ scope: "/" });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register: worker, ready: Promise.resolve({ scope: "/" }) },
  });
});
afterEach(() => vi.unstubAllGlobals());
test("사용자 권한을 얻은 뒤 FID 등록을 기다리고 abort 시 listener를 한 번만 정리한다", async () => {
  const onRegistered = vi.fn(async () => {});
  const controller = new AbortController();
  const stop = await connectPush(
    config,
    { onRegistered, onMessage: vi.fn(), onError: vi.fn() },
    controller.signal,
  );
  expect(onRegistered).toHaveBeenCalledWith("c1234567890123456789012");
  expect(worker).toHaveBeenCalledWith("/firebase-messaging-sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  controller.abort();
  stop();
  expect(sdk.offRegistered).toHaveBeenCalledTimes(1);
  expect(sdk.offMessage).toHaveBeenCalledTimes(1);
});
test("권한 거부 시 SDK나 OS 권한 요청을 시작하지 않는다", async () => {
  vi.stubGlobal("Notification", { permission: "denied" });
  await expect(
    connectPush(
      config,
      { onRegistered: vi.fn(), onMessage: vi.fn(), onError: vi.fn() },
      new AbortController().signal,
    ),
  ).rejects.toThrow("PUSH_PERMISSION_REQUIRED");
  expect(sdk.register).not.toHaveBeenCalled();
});
test("등록 도중 종료된 이전 화면은 새 listener를 등록하지 않는다", async () => {
  let ready: (value: unknown) => void = () => {};
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: worker,
      ready: new Promise((resolve) => {
        ready = resolve;
      }),
    },
  });
  const controller = new AbortController();
  const connecting = connectPush(
    config,
    { onRegistered: vi.fn(), onMessage: vi.fn(), onError: vi.fn() },
    controller.signal,
  );
  await vi.waitFor(() => expect(worker).toHaveBeenCalled());
  controller.abort();
  ready({});
  await connecting;
  expect(sdk.onMessage).not.toHaveBeenCalled();
  expect(sdk.register).not.toHaveBeenCalled();
});
