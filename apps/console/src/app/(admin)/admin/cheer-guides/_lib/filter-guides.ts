import type { AdminCheerGuideSummary } from "@/entities/cheer-guide";

export const initialGuideFilters = { search: "", mode: "all", source: "all", publication: "all" };
export type GuideFilters = typeof initialGuideFilters;
export function filterGuides(guides: AdminCheerGuideSummary[], filters: GuideFilters) {
  const search = filters.search.trim().toLowerCase();
  return guides.filter(
    ({ song, mode, currentPublication: publication }) =>
      (!search ||
        [song.title, song.albumName, song.slug ?? ""].some((value) =>
          value.toLowerCase().includes(search),
        )) &&
      (filters.mode === "all" || mode === filters.mode) &&
      (filters.source === "all" || (publication?.sourceType ?? "NONE") === filters.source) &&
      (filters.publication === "all" || (publication?.action ?? "NONE") === filters.publication),
  );
}
