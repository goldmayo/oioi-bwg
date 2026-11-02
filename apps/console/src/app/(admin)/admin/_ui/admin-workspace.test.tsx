import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { AdminPageLocation } from "../_model/admin-location";

import { AdminWorkspace } from "./admin-workspace";

const route = vi.hoisted(() => ({ pathname: "/admin/songs" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/features/auth", () => ({ signOut: vi.fn() }));
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
