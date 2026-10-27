"use client";

import { useEffect } from "react";
import type { PublishedCheerGuide } from "@oioi-bwg/contracts/song";
import { parseAsString, useQueryState } from "nuqs";

const guideParam = parseAsString.withOptions({ history: "replace", shallow: true });
export function usePublishedGuide(guides: PublishedCheerGuide[] = []) {
  const [guideId, setGuideId] = useQueryState("guide", guideParam);
  const selectedGuide =
    guides.find(({ id }) => id === guideId) ??
    guides.find(({ mode }) => mode === "CONCERT") ??
    guides[0];
  useEffect(() => {
    if (guideId !== null && guideId !== selectedGuide?.id) void setGuideId(null);
  }, [guideId, selectedGuide?.id, setGuideId]);
  return { selectedGuide, setGuideId };
}
