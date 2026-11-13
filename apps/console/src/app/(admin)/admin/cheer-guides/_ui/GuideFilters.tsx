import { Input } from "@/shared/ui/input";
import { FilterSelect, ListFilterSheet } from "@/shared/ui/list-filter-sheet";

import { type GuideFilters as Filters, initialGuideFilters } from "../_lib/filter-guides";

const choices = [
  {
    key: "mode",
    label: "공연 모드",
    options: [
      ["all", "전체 모드"],
      ["CONCERT", "콘서트"],
      ["FESTIVAL", "페스티벌"],
    ],
  },
  {
    key: "source",
    label: "출처",
    options: [
      ["all", "전체 출처"],
      ["OFFICIAL", "공식"],
      ["FANDOM", "팬덤"],
      ["NONE", "공개 이력 없음"],
    ],
  },
  {
    key: "publication",
    label: "공개 조치",
    options: [
      ["all", "전체 공개 조치"],
      ["PUBLISH", "공개"],
      ["UNPUBLISH", "공개 중단"],
      ["NONE", "공개 이력 없음"],
    ],
  },
] as const;
export function GuideFilters({
  filters,
  onChange,
  onApply,
}: {
  filters: Filters;
  onChange: (key: "search", value: string) => void;
  onApply: (values: Omit<Filters, "search">) => void;
}) {
  const activeCount = choices.filter(({ key }) => filters[key] !== "all").length;
  const { search, ...values } = filters;
  const defaults = {
    mode: initialGuideFilters.mode,
    source: initialGuideFilters.source,
    publication: initialGuideFilters.publication,
  };
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Input
        aria-label="응원법 검색"
        placeholder="곡·앨범 검색"
        value={search}
        onChange={(event) => onChange("search", event.target.value)}
        className="h-11 min-w-0 flex-1 md:h-9 md:max-w-xs"
      />
      <ListFilterSheet
        id="guide-filters"
        title="응원법 필터"
        activeCount={activeCount}
        values={values}
        defaults={defaults}
        onApply={onApply}
      >
        {({ register }) =>
          choices.map(({ key, label, options }) => (
            <FilterSelect key={key} label={label} {...register(key)}>
              {options.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </FilterSelect>
          ))
        }
      </ListFilterSheet>
    </div>
  );
}
