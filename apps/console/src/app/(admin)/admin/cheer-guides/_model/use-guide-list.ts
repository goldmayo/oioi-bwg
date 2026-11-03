import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";

import { cheerGuideQueries } from "@/entities/cheer-guide";

import { filterGuides, type GuideFilters, initialGuideFilters } from "../_lib/filter-guides";

export function useGuideList() {
  const {
    data: { items },
  } = useSuspenseQuery(cheerGuideQueries.adminList());
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [filters, setFilters] = useState(initialGuideFilters);
  const guides = useMemo(() => filterGuides(items, filters), [items, filters]);
  return {
    guides,
    selection,
    setSelection,
    selected: items.filter((guide) => selection[guide.id]),
    filters,
    total: items.length,
    hasFilter: Object.keys(filters).some(
      (key) =>
        filters[key as keyof GuideFilters] !== initialGuideFilters[key as keyof GuideFilters],
    ),
    changeFilter: (key: keyof GuideFilters, value: string) =>
      setFilters((previous) => ({ ...previous, [key]: value })),
  };
}
