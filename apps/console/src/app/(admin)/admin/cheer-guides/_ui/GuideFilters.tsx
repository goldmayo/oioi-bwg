import { SlidersHorizontal } from "lucide-react";

import { useMediaQuery } from "@/shared/model/useMediaQuery";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";

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
  const wide = useMediaQuery("(min-width: 768px)");
  const activeCount = choices.filter(({ key }) => filters[key] !== "all").length;
  const fields = choices.map(({ key, label, options }) => (
    <div key={key} className="grid gap-1.5">
      {!wide ? <span className="text-muted-foreground text-xs">{label}</span> : null}
      <Select value={filters[key]} onValueChange={(value) => onChange(key, value)}>
        <SelectTrigger
          aria-label={label}
          className="w-full data-[size=default]:h-11 md:w-40 md:data-[size=default]:h-9"
        >
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
        placeholder={wide ? "곡 제목, 앨범, Slug 검색" : "곡·앨범 검색"}
        value={filters.search}
        onChange={(event) => onChange("search", event.target.value)}
        className="h-11 min-w-0 flex-1 md:h-9 md:max-w-xs"
      />
      {wide ? (
        <div className="flex flex-wrap gap-2">{fields}</div>
      ) : (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" className="h-11 gap-1.5 md:hidden">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              필터{activeCount > 0 ? <span className="tabular-nums">{activeCount}</span> : null}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="bg-popover max-h-dvh overflow-y-auto rounded-t-xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="p-0 text-left">
              <SheetTitle>응원법 필터</SheetTitle>
              <SheetDescription>공연 모드, 출처, 공개 조치로 목록을 좁힙니다.</SheetDescription>
            </SheetHeader>
            <div className="grid gap-3">{fields}</div>
            <SheetClose asChild>
              <Button className="h-11">완료</Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
