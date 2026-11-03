import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import type { AdminCheerGuideSummary } from "@/entities/cheer-guide";

import { GuideTable } from "./GuideTable";

afterEach(cleanup);

const guide: AdminCheerGuideSummary = {
  id: "019a0170-0000-7000-8000-000000000001",
  mode: "CONCERT",
  updatedAt: "2026-11-03",
  song: {
    id: "019a0170-0000-7000-8000-000000000002",
    title: "고민중독",
    slug: "tbh",
    albumName: "MANITO",
  },
  currentPublication: null,
  draftEditorAvailable: true,
  editorAvailable: true,
  deletable: false,
};

function table(guides: AdminCheerGuideSummary[], canManage = true) {
  return (
    <GuideTable
      guides={guides}
      canManage={canManage}
      hasFilter={false}
      selection={{}}
      onSelectionChange={() => {}}
      onDelete={() => {}}
    />
  );
}

it("같은 곡도 모드별 응원법 ID로 진입하고 목록 복귀 경로를 보존한다", () => {
  const festivalId = "019a0170-0000-7000-8000-000000000003";
  render(table([guide, { ...guide, id: festivalId, mode: "FESTIVAL" }]));
  const links = screen.getAllByRole("link", { name: "고민중독" });
  expect(links.map((link) => link.getAttribute("href"))).toEqual(
    [guide.id, festivalId].map(
      (id) => `/admin/cheer-guides/${id}/edit?returnTo=%2Fadmin%2Fcheer-guides`,
    ),
  );
});

it("legacy 편집 경로에는 응원법 ID를 전달하고 편집 불가·권한 회수 시 제목 링크를 제거한다", () => {
  const legacy = { ...guide, draftEditorAvailable: false };
  const view = render(table([legacy]));
  expect(screen.getByRole("link", { name: "고민중독" }).getAttribute("href")).toBe(
    `/admin/edit/tbh?guideId=${guide.id}`,
  );
  view.rerender(table([{ ...legacy, editorAvailable: false }]));
  expect(screen.queryByRole("link", { name: "고민중독" })).toBeNull();
  view.rerender(table([{ ...legacy, song: { ...legacy.song, slug: null } }]));
  expect(screen.queryByRole("link", { name: "고민중독" })).toBeNull();
  view.rerender(table([guide], false));
  expect(screen.queryByRole("link", { name: "고민중독" })).toBeNull();
  expect(screen.getByText("고민중독")).toBeTruthy();
});
