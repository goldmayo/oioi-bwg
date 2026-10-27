import "server-only";

type GuideState<Snapshot> = {
  id: string;
  mode: "CONCERT" | "FESTIVAL";
  publications: { id: string }[];
  currentPublication: { action: "PUBLISH" | "UNPUBLISH"; snapshot: Snapshot | null } | null;
};
type Source = { sourceType: "OFFICIAL" | "FANDOM"; referenceYoutubeId: string };

export function currentPublishedGuides<Snapshot extends Source>(
  guides: GuideState<Snapshot>[] | undefined,
  youtubeId: string | null,
) {
  return (guides ?? [])
    .flatMap((guide) => {
      const publication = guide.currentPublication;
      return publication?.action === "PUBLISH" &&
        publication.snapshot?.referenceYoutubeId === youtubeId
        ? [{ id: guide.id, mode: guide.mode, snapshot: publication.snapshot }]
        : [];
    })
    .sort((a, b) => (a.mode === b.mode ? 0 : a.mode === "CONCERT" ? -1 : 1));
}
export function hasGuidePublication(guides: { publications: { id: string }[] }[] | undefined) {
  return guides?.some(({ publications }) => publications.length > 0) ?? false;
}
export function defaultGuideIsOfficial(
  guides: GuideState<Source>[] | undefined,
  youtubeId: string | null,
  legacy: boolean | null,
) {
  return hasGuidePublication(guides)
    ? currentPublishedGuides(guides, youtubeId)[0]?.snapshot.sourceType === "OFFICIAL"
    : (legacy ?? false);
}
