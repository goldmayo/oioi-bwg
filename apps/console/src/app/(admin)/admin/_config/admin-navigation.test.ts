import { expect, it } from "vitest";

import { getAdminPageId } from "@/shared/config/admin-routes";

import { getAdminNavigation } from "./admin-navigation";

it.each([
  ["/admin", ["대시보드"]],
  ["/admin/dashboard/settings", ["대시보드", "대시보드 관리"]],
  ["/admin/albums", ["콘솔", "앨범 관리"]],
  ["/admin/albums/new", ["콘솔", "앨범 관리", "앨범 추가"]],
  ["/admin/albums/123/edit", ["콘솔", "앨범 관리", "앨범 정보 수정"]],
  ["/admin/songs", ["콘솔", "곡 관리"]],
  ["/admin/songs/new", ["콘솔", "곡 관리", "곡 추가"]],
  ["/admin/songs/123", ["콘솔", "곡 관리", "곡 정보"]],
  ["/admin/edit/song", ["콘솔", "곡 관리", "가사 편집"]],
  ["/admin/cheer-guides", ["콘솔", "응원법 관리"]],
  ["/admin/cheer-guides/new", ["콘솔", "응원법 관리", "응원법 추가"]],
  ["/admin/cheer-guides/123/edit", ["콘솔", "응원법 관리", "응원법 편집"]],
  ["/admin/notifications", ["콘솔", "알림 내역"]],
  ["/admin/waveform-jobs/123", ["콘솔", "알림 내역", "파형 생성 결과"]],
])("%s 화면을 루트 레이아웃의 경로 계층으로 표현한다", (pathname, labels) => {
  expect(
    getAdminNavigation(getAdminPageId(pathname)).breadcrumbs.map(({ label }) => label),
  ).toEqual(labels);
});
it("상세 제목은 마지막 항목에만 사용하고 실제 메뉴 링크를 보존한다", () => {
  expect(getAdminNavigation("guideEdit", "곡 · 콘서트 편집").breadcrumbs).toEqual([
    { label: "콘솔", href: "/admin" },
    { label: "응원법 관리", href: "/admin/cheer-guides" },
    { label: "곡 · 콘서트 편집" },
  ]);
});
it("유사한 경로를 메뉴로 오인하거나 내부 식별자를 화면 문구로 표시하지 않는다", () => {
  expect(getAdminNavigation(getAdminPageId("/admin/songs-unknown/private")).breadcrumbs).toEqual([
    { label: "콘솔", href: "/admin" },
    { label: "관리자 페이지" },
  ]);
});
