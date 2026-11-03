import type { Notification } from "@oioi-bwg/contracts/notification";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { notificationQueries } from "@/entities/notification";

import {
  NavigationConfirmationProvider,
  useNavigationBlocker,
} from "@/shared/model/navigation-confirmation";

import { NotificationHistory } from "./NotificationHistory";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  postVoid: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
}));
vi.mock("@/shared/api/http-client", () => ({ http: mocks }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
vi.mock("@/shared/model/useMediaQuery", () => ({ useMediaQuery: () => true }));
vi.mock("../../_ui/notification-provider", () => ({
  useNotificationContext: () => ({
    accountId,
    pushState: "enabled",
    enable: mocks.enable,
    disable: mocks.disable,
  }),
}));

const accountId = "019a0170-0000-7000-8000-000000000001";
let client: QueryClient;
let items: Notification[];
const requests = () =>
  mocks.get.mock.calls
    .filter(([url]) => url.includes("/history?"))
    .map(([url]) => new URL(url, "http://local").searchParams);
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  items = Array.from({ length: 25 }, (_, index) => ({
    id: `019a0170-0000-7000-8000-${String(index + 2).padStart(12, "0")}`,
    resourceId: accountId,
    resourceType: "WAVEFORM_JOB",
    type: index % 2 ? "WAVEFORM_FAILED" : "WAVEFORM_SUCCEEDED",
    title: `작업 결과 ${index + 1}`,
    createdAt: "2026-11-03T00:00:00.000Z",
    readAt: index < 20 ? "2026-11-03T01:00:00.000Z" : null,
    href: `/admin/waveform-jobs/${accountId}`,
  }));
  mocks.get.mockImplementation(async (url: string) => {
    if (!url.includes("/history?")) return items.find((item) => url.endsWith(item.id));
    const query = new URL(url, "http://local").searchParams;
    const filtered = items.filter(
      (item) =>
        (query.get("status") !== "unread" || !item.readAt) &&
        (!query.has("type") || item.type === query.get("type")),
    );
    const offset = Number(query.get("offset"));
    return {
      items: filtered.slice(offset, offset + Number(query.get("limit"))),
      totalCount: filtered.length,
      unreadCount: items.filter((item) => !item.readAt).length,
    };
  });
  mocks.patch.mockImplementation(async (url: string) => {
    const item = items.find((item) => url.includes(item.id))!;
    item.readAt = item.createdAt;
    return { ...item };
  });
  mocks.postVoid.mockImplementation(async () => {
    items = items.map((item) => ({ ...item, readAt: item.createdAt }));
  });
  mocks.disable.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});
function mount(searchParams = "", selectedId?: string, blocker?: (proceed: () => void) => void) {
  function DirtyForm() {
    useNavigationBlocker(blocker ?? null);
    return null;
  }
  render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter hasMemory searchParams={searchParams}>
        <NavigationConfirmationProvider>
          <DirtyForm />
          <NotificationHistory selectedId={selectedId} />
        </NavigationConfirmationProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

it("기본 10개와 STATUS를 표시하고 목록 진입만으로 읽지 않으며 선택 UI를 제공하지 않는다", async () => {
  mount();
  await screen.findByText("1-10 of 25");
  expect(screen.getByRole("columnheader", { name: /STATUS/ })).toBeTruthy();
  expect(screen.getAllByText("READ")).toHaveLength(10);
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(mocks.patch).not.toHaveBeenCalled();
  expect(requests()[0].get("limit")).toBe("10");
  expect(mocks.get.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it("다음 페이지·표시 개수는 서버 페이지를 요청하며 필터 변경은 첫 페이지로 돌아간다", async () => {
  mount();
  await screen.findByText("1-10 of 25");
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByText("11-20 of 25");
  expect(requests().at(-1)?.get("offset")).toBe("10");
  fireEvent.change(screen.getByRole("combobox", { name: "표시 개수" }), {
    target: { value: "20" },
  });
  await screen.findByText("1-20 of 25");
  fireEvent.mouseDown(screen.getByRole("tab", { name: /안 읽은 알림/ }), {
    button: 0,
    ctrlKey: false,
  });
  await screen.findByText("1-5 of 5");
  expect(screen.getAllByText("UNREAD")).toHaveLength(5);
  expect(requests().at(-1)?.get("status")).toBe("unread");
});
it("URL의 상태·결과 필터를 AND로 적용하고 조회 범위를 벗어난 페이지를 보정한다", async () => {
  mount("?view=unread&result=WAVEFORM_FAILED&page=4");
  await screen.findByText("1-2 of 2");
  expect(requests().at(-1)?.get("offset")).toBe("0");
  expect(requests().at(-1)?.get("type")).toBe("WAVEFORM_FAILED");
  expect(screen.getAllByText("UNREAD")).toHaveLength(2);
});
it("읽음 처리가 성공한 뒤 미저장 확인을 거쳐 이동하며 중복 클릭은 한 번만 처리한다", async () => {
  const block = vi.fn();
  mount("?view=unread", undefined, block);
  const title = await screen.findByRole("button", { name: /작업 결과 21/ });
  fireEvent.click(title.closest("tr")!.querySelector("td")!);
  fireEvent.click(title);
  await waitFor(() => expect(block).toHaveBeenCalledTimes(1));
  expect(mocks.patch).toHaveBeenCalledTimes(1);
  expect(mocks.push).not.toHaveBeenCalled();
  await act(() => block.mock.calls[0][0]());
  expect(mocks.push).toHaveBeenCalledWith(items[20].href);
});
it("읽음 실패 시 이동하지 않고 같은 항목으로 다시 시도할 수 있다", async () => {
  mocks.patch.mockRejectedValueOnce(new Error("offline"));
  mount("?view=unread");
  fireEvent.click(await screen.findByRole("button", { name: /작업 결과 21/ }));
  await screen.findByText(/읽음 처리를 완료하지 못했습니다/);
  expect(mocks.push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /작업 결과 21/ }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
});
it("모두 읽음은 필터 밖까지 처리하고 계정의 벨·내역 캐시를 함께 갱신한다", async () => {
  const bell = notificationQueries.list(accountId).queryKey;
  const other = notificationQueries.list("other-account").queryKey;
  client.setQueryData(bell, { pages: [], pageParams: [] });
  client.setQueryData(other, { pages: [], pageParams: [] });
  mount("?view=unread&result=WAVEFORM_FAILED");
  await screen.findByText("1-2 of 2");
  fireEvent.click(screen.getByRole("button", { name: "모두 읽음" }));
  await screen.findByText("조건에 맞는 알림이 없습니다.");
  expect(mocks.postVoid).toHaveBeenCalledWith("/api/admin/notifications/read-all");
  expect(items.every((item) => item.readAt)).toBe(true);
  expect(client.getQueryState(bell)?.isInvalidated).toBe(true);
  expect(client.getQueryState(other)?.isInvalidated).toBe(false);
});
it("조회 실패에서 재시도하고 단건 알림 진입은 읽은 뒤 결과로 대체 이동한다", async () => {
  mocks.get.mockRejectedValueOnce(new Error("offline"));
  mount();
  await screen.findByText("알림을 불러오지 못했습니다.");
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  await screen.findByText("1-10 of 25");
  cleanup();
  mount("", items[24].id);
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(items[24].href));
  expect(mocks.patch).toHaveBeenCalledTimes(1);
});
it("브라우저 알림은 사용자 조작으로만 변경하며 실패를 알린다", async () => {
  mocks.disable.mockRejectedValueOnce(new Error("offline"));
  mount();
  await screen.findByText("1-10 of 25");
  expect(mocks.disable).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch", { name: "브라우저 알림" }));
  await screen.findByText(/브라우저 알림 설정을 변경하지 못했습니다/);
  expect(mocks.disable).toHaveBeenCalledOnce();
});
