import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { NotificationInbox } from "./notification-inbox";
import { NotificationProvider } from "./notification-provider";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  postVoid: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/shared/api/http-client", () => ({ http: mocks }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
const accountId = "019a0170-0000-7000-8000-000000000001";
const item = {
  id: "019a0170-0000-7000-8000-000000000002",
  type: "WAVEFORM_SUCCEEDED",
  resourceType: "WAVEFORM_JOB",
  resourceId: accountId,
  createdAt: "2026-10-27T00:00:00.000Z",
  readAt: null,
  title: "파형 생성을 완료했습니다.",
  href: `/admin/waveform-jobs/${accountId}`,
};
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mocks.get.mockImplementation((url: string) =>
    Promise.resolve(url.includes("?") ? { items: [item], nextCursor: null, unreadCount: 1 } : item),
  );
  mocks.patch.mockResolvedValue({ ...item, readAt: item.createdAt });
  mocks.postVoid.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});
function mount(selectedId?: string) {
  render(
    <QueryClientProvider client={client}>
      <NotificationProvider accountId={accountId} config={null}>
        <NotificationInbox selectedId={selectedId} />
      </NotificationProvider>
    </QueryClientProvider>,
  );
}
it("푸시를 사용할 수 없어도 내역을 표시하며 열기만 해서는 읽지 않는다", async () => {
  mount();
  await screen.findByRole("button", { name: /파형 생성을 완료했습니다/ });
  expect(screen.getByText(/결과는 알림함에서/)).toBeTruthy();
  expect(mocks.patch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /파형 생성을 완료했습니다/ }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(item.href));
  expect(mocks.patch).toHaveBeenCalledWith(`/api/admin/notifications/${item.id}/read`);
});
it("모두 읽음의 204 응답을 수용하고 내역을 갱신한다", async () => {
  mount();
  await screen.findByRole("button", { name: /파형 생성을 완료했습니다/ });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "모두 읽음" }));
  });
  await waitFor(() =>
    expect(mocks.postVoid).toHaveBeenCalledWith("/api/admin/notifications/read-all"),
  );
  await waitFor(() =>
    expect(mocks.get.mock.calls.filter(([url]) => url.includes("?")).length).toBeGreaterThan(1),
  );
});
it("OS 알림 선택은 검증된 단건을 읽은 뒤 결과로 이동한다", async () => {
  mount(item.id);
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(item.href));
  expect(mocks.patch).toHaveBeenCalledTimes(1);
});
it("다른 계정의 조회 캐시를 함께 사용하지 않는다", async () => {
  const { notificationQueryKeys } = await import("@/entities/notification");
  expect(notificationQueryKeys.all(accountId)).not.toEqual(
    notificationQueryKeys.all("other-account"),
  );
});
