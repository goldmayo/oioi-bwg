import { expect, it } from "vitest";

import type { AdminCheerGuideSummary } from "@/entities/cheer-guide";

import { filterGuides, initialGuideFilters } from "./filter-guides";

const guide: AdminCheerGuideSummary = {
  id: "guide",
  mode: "CONCERT",
  updatedAt: "",
  editorAvailable: true,
  song: { id: "song", title: "고민중독", albumName: "MANITO", slug: "song" },
  currentPublication: { sourceType: "OFFICIAL", action: "PUBLISH" },
};
const festival: AdminCheerGuideSummary = {
  ...guide,
  id: "festival",
  mode: "FESTIVAL",
  currentPublication: { sourceType: "FANDOM", action: "UNPUBLISH" },
};
const unknown = { ...festival, id: "unknown", currentPublication: null };
it("같은 곡의 모드별 행을 유지하고 검색·모드·출처·공개 조치를 AND로 적용한다", () => {
  expect(filterGuides([guide, festival, unknown], initialGuideFilters)).toHaveLength(3);
  const filters = {
    search: " manito ",
    mode: "FESTIVAL",
    source: "FANDOM",
    publication: "UNPUBLISH",
  };
  expect(filterGuides([guide, festival, unknown], filters)).toEqual([festival]);
  expect(filterGuides([guide, festival], { ...filters, publication: "PUBLISH" })).toEqual([]);
});
it("이력 없는 응원법을 팬 제작 또는 공개 중단으로 추론하지 않는다", () => {
  const guides = [guide, festival, unknown];
  expect(filterGuides(guides, { ...initialGuideFilters, publication: "NONE" })).toEqual([unknown]);
  expect(filterGuides(guides, { ...initialGuideFilters, source: "NONE" })).toEqual([unknown]);
  expect(filterGuides(guides, { ...initialGuideFilters, source: "FANDOM" })).toEqual([festival]);
});
