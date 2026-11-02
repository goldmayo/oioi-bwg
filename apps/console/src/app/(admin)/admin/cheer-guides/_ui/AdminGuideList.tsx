"use client";

import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { authAbilityQueries, createClientAbility } from "@/features/auth";

import { Button } from "@/shared/ui/button";

import { useGuideList } from "../_model/use-guide-list";

import { GuideFilters } from "./GuideFilters";
import { GuideTable } from "./GuideTable";

export function AdminGuideList() {
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);
  const { guides, filters, total, changeFilter, hasFilter, selection, setSelection, selected } =
    useGuideList();
  return (
    <div className="space-y-4">
      <GuideFilters filters={filters} onChange={changeFilter} />
      <GuideTable
        guides={guides}
        canManage={ability.can("manage", "all")}
        hasFilter={hasFilter}
        selection={selection}
        onSelectionChange={setSelection}
      />
      {selected.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{selected.length}개 선택됨</span>
          <Button variant="ghost" onClick={() => setSelection({})}>
            선택 해제
          </Button>
        </div>
      )}
      <p className="text-muted-foreground text-sm">
        총 {guides.length}개 {hasFilter && `(전체 ${total}개)`}
      </p>
      <p className="text-muted-foreground text-xs leading-5">
        공개 조치는 응원법의 최근 공개·중단 기록입니다. 곡·앨범 설정과 기준 영상에 따라 사용자
        노출은 달라집니다.
      </p>
    </div>
  );
}
