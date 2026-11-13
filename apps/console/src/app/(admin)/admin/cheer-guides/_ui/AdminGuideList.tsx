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
import { ListHeader, ListSelection, ListToolbar } from "@/shared/ui/list-layout";

import { useGuideDeletion } from "../_model/use-guide-deletion";
import { useGuideList } from "../_model/use-guide-list";

import { GuideDeleteDialog } from "./GuideDeleteDialog";
import { GuideFilters } from "./GuideFilters";
import { GuideTable } from "./GuideTable";

export function AdminGuideList() {
  const { data } = useSuspenseQuery(authAbilityQueries.current());
  const ability = useMemo(() => createClientAbility(data.rules), [data.rules]);
  const { guides, filters, changeFilter, hasFilter, selection, setSelection, selected } =
    useGuideList();
  const canManage = ability.can("manage", "all");
  const deletion = useGuideDeletion(canManage, (ids) =>
    setSelection((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.includes(id))),
    ),
  );
  const protectedSelection = selected.some((guide) => !guide.deletable);
  return (
    <div className="space-y-3 md:space-y-4">
      <ListHeader
        title="응원법 관리"
        compactOnMobile
        description="곡의 공연 모드별 응원법을 확인합니다."
        action={
          canManage && (
            <Button variant="q" className="h-11 md:h-9" asChild>
              <a href={adminPaths.guideCreate}>응원법 추가</a>
            </Button>
          )
        }
      />
      <ListToolbar
        selection={
          <ListSelection
            count={selected.length}
            disabled={deletion.pending}
            onClear={() => setSelection({})}
          />
        }
        actions={
          selected.length > 0 && (
            <Button
              variant="destructive"
              disabled={!canManage || deletion.pending || protectedSelection}
              onClick={() => deletion.requestDelete(selected)}
            >
              선택 삭제
            </Button>
          )
        }
      >
        <GuideFilters filters={filters} onChange={changeFilter} />
      </ListToolbar>
      <AdminReauthenticationNotice recovery={deletion.recovery} />
      {deletion.targets.length === 0 && deletion.message && (
        <p role="status" className="text-sm">
          {deletion.message}
        </p>
      )}
      <GuideTable
        guides={guides}
        canManage={canManage && !deletion.pending}
        hasFilter={hasFilter}
        selection={selection}
        onSelectionChange={setSelection}
        onDelete={(guide) => deletion.requestDelete([guide])}
      />
      <GuideDeleteDialog deletion={deletion} canManage={canManage} />
    </div>
  );
}
