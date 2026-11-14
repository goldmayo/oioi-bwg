import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { AdminPageLocation } from "../_model/admin-location";

import { AdminWorkspace } from "./admin-workspace";

const route = vi.hoisted(() => ({ pathname: "/admin/songs" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/features/auth", () => ({
  useSignOut: () => ({
    open: false,
    pending: false,
    error: null,
    request: vi.fn(),
    cancel: vi.fn(),
    confirm: vi.fn(),
  }),
}));
vi.mock("./notification-bell", () => ({ NotificationBell: () => <button>알림</button> }));
afterEach(cleanup);
it("대시보드·목록·상세·편집 모두 같은 루트 헤더와 사이드바를 사용한다", () => {
  for (const pathname of [
    "/admin",
    "/admin/albums",
    "/admin/songs",
    "/admin/cheer-guides",
    "/admin/notifications",
    "/admin/edit/song",
    "/admin/cheer-guides/id/edit",
  ]) {
    route.pathname = pathname;
    const { unmount } = render(
      <AdminWorkspace>
        <h1>화면 본문</h1>
      </AdminWorkspace>,
    );
    expect(screen.getAllByRole("navigation", { name: "현재 위치" })).toHaveLength(1);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getByRole("complementary", { name: "관리자 탐색" })).toBeTruthy();
    expect(
      within(screen.getByRole("main")).getByRole("heading", { name: "화면 본문" }),
    ).toBeTruthy();
    unmount();
  }
});
it("대시보드 관리와 대시보드를 오갈 때 같은 주소의 경로 항목을 중복 표시하지 않는다", () => {
  route.pathname = "/admin/dashboard/settings";
  const workspace = () => <AdminWorkspace>화면 본문</AdminWorkspace>;
  const { rerender } = render(workspace());
  const breadcrumbs = screen.getByRole("navigation", { name: "현재 위치" });
  const labels = () =>
    within(breadcrumbs)
      .getAllByRole("listitem")
      .map((item) => item.textContent);

  expect(
    within(breadcrumbs).getByRole("link", { name: "대시보드로 돌아가기" }).getAttribute("href"),
  ).toBe("/admin");
  expect(labels()).toEqual(["대시보드", "대시보드 관리"]);

  route.pathname = "/admin";
  rerender(workspace());
  expect(labels()).toEqual(["대시보드"]);
});

it("페이지가 제공한 제목을 표시하며 다른 경로로 넘어가면 이전 제목을 쓰지 않는다", async () => {
  route.pathname = "/admin/songs/123";
  const { rerender } = render(
    <AdminWorkspace>
      <AdminPageLocation title="곡 A · 곡 정보" />
    </AdminWorkspace>,
  );
  await waitFor(() =>
    expect(screen.getByRole("navigation", { name: "현재 위치" }).textContent).toContain(
      "곡 A · 곡 정보",
    ),
  );
  route.pathname = "/admin/notifications";
  rerender(
    <AdminWorkspace>
      <p>알림 본문</p>
    </AdminWorkspace>,
  );
  expect(screen.getByRole("navigation", { name: "현재 위치" }).textContent).toContain("알림 내역");
  expect(screen.getByRole("navigation", { name: "현재 위치" }).textContent).not.toContain("곡 A");
});

it("페이지 제목과 경로가 바뀌어도 접힘 상태와 마운트된 본문의 입력을 보존한다", () => {
  route.pathname = "/admin/songs/123";
  const content = <input aria-label="편집 초안" defaultValue="" />;
  const { rerender } = render(
    <AdminWorkspace>
      <AdminPageLocation title="곡 A · 곡 정보" />
      {content}
    </AdminWorkspace>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "편집 초안" }), {
    target: { value: "미저장 입력" },
  });
  fireEvent.click(screen.getByRole("button", { name: "사이드바 접기" }));
  route.pathname = "/admin/songs/456";
  rerender(
    <AdminWorkspace>
      <AdminPageLocation title="곡 B · 곡 정보" />
      {content}
    </AdminWorkspace>,
  );
  expect(screen.getByRole("button", { name: "사이드바 열기" }).getAttribute("aria-expanded")).toBe(
    "false",
  );
  expect((screen.getByRole("textbox", { name: "편집 초안" }) as HTMLInputElement).value).toBe(
    "미저장 입력",
  );
  expect(screen.getByRole("navigation", { name: "현재 위치" }).textContent).toContain(
    "곡 B · 곡 정보",
  );
});
