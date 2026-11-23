import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import type { QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http as handlers, HttpResponse } from "msw";
import { beforeEach as beforeHttp } from "vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { http } from "@/shared/api/http-client";

import { createQueryClientFixture } from "../../../../../tests/query-client";

import { NotificationProvider, useNotificationContext } from "./notification-provider";

const server = createHttpTestServer(window.location.href);
const createClient = createQueryClientFixture();
let queryFixture: ReturnType<typeof createClient>;
beforeHttp(() => {
  vi.spyOn(http, "put");
  vi.spyOn(http, "delete");
});
const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  router: { push: vi.fn() },
}));
vi.mock("../_lib/push-client", () => ({
  connectPush: mocks.connect,
  disconnectPush: mocks.disconnect,
}));
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
  queryFixture = createClient({ defaultOptions: { mutations: { retry: false } } });
  client = queryFixture.client;
  vi.stubGlobal("Notification", { permission: "granted" });
  vi.stubGlobal("PushManager", class {});
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });
  server.use(handlers.put("*/api/admin/push-installations", () => HttpResponse.json({ id })));
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
  server.use(
    handlers.delete("*/api/admin/push-installations/:id", () => HttpResponse.error(), {
      once: true,
    }),
    handlers.delete(
      "*/api/admin/push-installations/:id",
      () => new HttpResponse(null, { status: 204 }),
    ),
  );
  render(
    <queryFixture.wrapper>
      <NotificationProvider accountId={id} config={config}>
        <Probe />
      </NotificationProvider>
    </queryFixture.wrapper>,
  );
  await screen.findByText("enabled");
  expect(localStorage.getItem("oioi:push-installation:v1")).toBe(id);
  fireEvent.click(screen.getByRole("button", { name: "끄기" }));
  await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledOnce());
  expect(localStorage.getItem("oioi:push-installation:v1")).toBe(id);
  fireEvent(window, new Event("online"));
  await waitFor(() => expect(localStorage.getItem("oioi:push-installation:v1")).toBeNull());
  expect(vi.mocked(http.delete)).toHaveBeenCalledTimes(2);
  expect(mocks.connect).toHaveBeenCalledTimes(1);
});
