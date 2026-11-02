import { Input } from "@/shared/ui/input";
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
      ["OFFICIAL", "official"],
      ["FANDOM", "fan-made"],
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
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Input
        aria-label="응원법 검색"
        placeholder="곡 제목, 앨범, Slug 검색"
        value={filters.search}
        onChange={(event) => onChange("search", event.target.value)}
        className="sm:max-w-xs"
      />
      {choices.map(({ key, label, options }) => (
        <Select key={key} value={filters[key]} onValueChange={(value) => onChange(key, value)}>
          <SelectTrigger aria-label={label} className="w-full sm:w-40">
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
      ))}
    </div>
  );
}
