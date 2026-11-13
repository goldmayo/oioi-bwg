import { Input } from "@/shared/ui/input";
import { ListFilterSheet } from "@/shared/ui/list-filter-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

import type { GuideFilters as Filters } from "../_lib/filter-guides";

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
}: {
  filters: Filters;
  onChange: (key: keyof Filters, value: string) => void;
}) {
  const activeCount = choices.filter(({ key }) => filters[key] !== "all").length;
  const fields = choices.map(({ key, label, options }) => (
    <div key={key} className="grid gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Select value={filters[key]} onValueChange={(value) => onChange(key, value)}>
        <SelectTrigger aria-label={label} className="w-full data-[size=default]:h-11">
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
    <div className="flex min-w-0 items-center gap-2">
      <Input
        aria-label="응원법 검색"
        placeholder="곡·앨범 검색"
        value={filters.search}
        onChange={(event) => onChange("search", event.target.value)}
        className="h-11 min-w-0 flex-1 md:h-9 md:max-w-xs"
      />
      <ListFilterSheet
        title="응원법 필터"
        description="공연 모드, 출처, 공개 조치로 목록을 좁힙니다."
        activeCount={activeCount}
      >
        {fields}
      </ListFilterSheet>
    </div>
  );
}
