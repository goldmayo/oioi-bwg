"use client";

import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import {
  AdminReauthenticationNotice,
  authAbilityQueries,
  createClientAbility,
} from "@/features/auth";

import { adminPaths } from "@/shared/config/admin-routes";
import { Button } from "@/shared/ui/button";

import { useGuideDeletion } from "../_model/use-guide-deletion";
import { useGuideList } from "../_model/use-guide-list";

import { GuideDeleteDialog } from "./GuideDeleteDialog";
import { GuideFilters } from "./GuideFilters";
import { GuideTable } from "./GuideTable";

export function AdminGuideList() {
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);
  const { guides, filters, total, changeFilter, hasFilter, selection, setSelection, selected } =
    useGuideList();
  const canManage = ability.can("manage", "all");
  const deletion = useGuideDeletion(canManage, (ids) =>
    setSelection((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.includes(id))),
    ),
  );
  const protectedSelection = selected.some((guide) => !guide.deletable);
  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button asChild className="bg-qwer-e hover:bg-qwer-e/90 text-neutral-950">
            <a href={adminPaths.guideCreate}>응원법 추가</a>
          </Button>
        </div>
      )}
      <GuideFilters filters={filters} onChange={changeFilter} />
      <AdminReauthenticationNotice recovery={deletion.recovery} />
      {deletion.targets.length === 0 && deletion.message && (
        <p role="status" className="text-sm">
          {deletion.message}
        </p>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-sm">{selected.length}개 선택됨</span>
          <Button
            variant="destructive"
            disabled={!canManage || deletion.pending || protectedSelection}
            onClick={() => deletion.requestDelete(selected)}
          >
            선택 삭제
          </Button>
          <Button variant="ghost" disabled={deletion.pending} onClick={() => setSelection({})}>
            선택 해제
          </Button>
          {protectedSelection && (
            <span className="text-muted-foreground text-xs">
              내용 또는 공개 이력이 없는 응원법만 삭제할 수 있습니다.
            </span>
          )}
        </div>
      )}
      <GuideTable
        guides={guides}
        canManage={canManage && !deletion.pending}
        hasFilter={hasFilter}
        selection={selection}
        onSelectionChange={setSelection}
        onDelete={(guide) => deletion.requestDelete([guide])}
      />
      <p className="text-muted-foreground text-sm">
        총 {guides.length}개 {hasFilter && `(전체 ${total}개)`}
      </p>
      <GuideDeleteDialog deletion={deletion} canManage={canManage} />
      <p className="text-muted-foreground text-xs leading-5">
        공개 조치는 응원법의 최근 공개·중단 기록입니다. 곡·앨범 설정과 기준 영상에 따라 사용자
        노출은 달라집니다. 내용 또는 공개 이력이 있는 응원법은 삭제할 수 없습니다.
      </p>
    </div>
  );
}
