import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { NotificationProvider, useNotificationContext } from "./notification-provider";
const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  router: { push: vi.fn() },
}));
vi.mock("../_lib/push-client", () => ({
  connectPush: mocks.connect,
  disconnectPush: mocks.disconnect,
}));
vi.mock("@/shared/api/http-client", () => ({ http: { put: mocks.put, delete: mocks.delete } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
const id = "019a0170-0000-7000-8000-000000000001";
const config = {
  apiKey: "public",
  projectId: "demo-push",
  appId: "demo-app",
  messagingSenderId: "123",
  vapidKey: "a".repeat(87),
};
let client: QueryClient;
const original = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
beforeEach(() => {
  localStorage.clear();
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  vi.stubGlobal("Notification", { permission: "granted" });
  vi.stubGlobal("PushManager", class {});
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });
  mocks.put.mockResolvedValue({ id });
  mocks.disconnect.mockResolvedValue(undefined);
  mocks.connect.mockImplementation(async (_config, handlers) => {
    await handlers.onRegistered("local-fid-1234567890123");
    return () => {};
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  if (original) Object.defineProperty(navigator, "serviceWorker", original);
  else Reflect.deleteProperty(navigator, "serviceWorker");
});
function Probe() {
  const value = useNotificationContext();
  return (
    <>
      <output>{value.pushState}</output>
      <button
        onClick={() => {
          void value.disable().catch(() => {});
        }}
      >
        끄기
      </button>
    </>
  );
}
it("해제 중 연결이 끊겨도 등록 ID를 보존하고 재연결에 회수를 재시도한다", async () => {
  mocks.delete.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={client}>
      <NotificationProvider accountId={id} config={config}>
        <Probe />
      </NotificationProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("enabled");
  expect(localStorage.getItem("oioi:push-installation:v1")).toBe(id);
  fireEvent.click(screen.getByRole("button", { name: "끄기" }));
  await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledOnce());
  expect(localStorage.getItem("oioi:push-installation:v1")).toBe(id);
  fireEvent(window, new Event("online"));
  await waitFor(() => expect(localStorage.getItem("oioi:push-installation:v1")).toBeNull());
  expect(mocks.delete).toHaveBeenCalledTimes(2);
  expect(mocks.connect).toHaveBeenCalledTimes(1);
});
