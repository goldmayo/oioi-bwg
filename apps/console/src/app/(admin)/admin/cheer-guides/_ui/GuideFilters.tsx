import { useMediaQuery } from "@/shared/model/useMediaQuery";
import { Input } from "@/shared/ui/input";
import { FilterSelect, ListFilterSheet } from "@/shared/ui/list-filter-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

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
  onChange: (key: keyof Filters, value: string) => void;
  onApply: (values: Omit<Filters, "search">) => void;
}) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const activeCount = choices.filter(({ key }) => filters[key] !== "all").length;
  const { search, ...values } = filters;
  const defaults = {
    mode: initialGuideFilters.mode,
    source: initialGuideFilters.source,
    publication: initialGuideFilters.publication,
  };
  const fields = choices.map(({ key, label, options }) => (
    <div key={key} className="grid gap-1.5">
      <Select value={filters[key]} onValueChange={(value) => onChange(key, value)}>
        <SelectTrigger aria-label={label} className="w-40 data-[size=default]:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ));
  return (
    <div className="flex min-w-0 items-center gap-2 md:flex-wrap">
      <Input
        aria-label="응원법 검색"
        placeholder={desktop ? "곡 제목, 앨범, Slug 검색" : "곡·앨범 검색"}
        value={search}
        onChange={(event) => onChange("search", event.target.value)}
        className="h-11 min-w-0 flex-1 md:h-9 md:max-w-xs"
      />
      <div className="hidden flex-wrap gap-2 md:flex">{fields}</div>
      <ListFilterSheet
        id="guide-filters"
        title="응원법 필터"
        activeCount={activeCount}
        values={values}
        defaults={defaults}
        onApply={onApply}
      >
        {({ control }) =>
          choices.map(({ key, label, options }) => (
            <FilterSelect key={key} label={label} control={control} name={key}>
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
