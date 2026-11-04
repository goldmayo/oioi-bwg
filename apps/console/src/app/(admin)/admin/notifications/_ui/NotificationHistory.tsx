"use client";

import type { NotificationType } from "@oioi-bwg/contracts/notification";
import { CheckCheck } from "lucide-react";
import { Tabs } from "radix-ui";

import { Button } from "@/shared/ui/button";
import { ListHeader } from "@/shared/ui/list-layout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

import { BrowserNotificationSwitch } from "../../_ui/browser-notification-switch";
import { useNotificationContext } from "../../_ui/notification-provider";
import { useNotificationHistory } from "../_model/use-notification-history";

import { NotificationTable } from "./NotificationTable";

const tabClass =
  "text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground focus-visible:outline-ring h-7 shrink-0 rounded px-3 text-sm font-medium whitespace-nowrap outline-none hover:text-foreground focus-visible:outline-2";
export function NotificationHistory({ selectedId }: { selectedId?: string }) {
  const { accountId } = useNotificationContext();
  const history = useNotificationHistory(accountId, selectedId);
  const { actions, filters, query } = history;
  return (
    <section className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <ListHeader
          title="알림 내역"
          description="작업 결과와 놓친 알림을 확인합니다."
          action={
            <Button
              variant="secondary"
              disabled={!history.unreadCount || actions.all.isPending || query.isPending}
              onClick={() => actions.all.mutate()}
            >
              <CheckCheck className="size-4" />
              모두 읽음
            </Button>
          }
        />
        <Tabs.Root
          value={filters.view}
          onValueChange={(value) => history.changeView(value as "all" | "unread")}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Tabs.List
                aria-label="알림 모아보기"
                className="bg-muted inline-flex h-9 shrink-0 items-center gap-1 rounded-md p-1"
              >
                <Tabs.Trigger value="all" className={tabClass}>
                  전체 알림
                </Tabs.Trigger>
                <Tabs.Trigger value="unread" className={`${tabClass} flex items-center gap-2`}>
                  안 읽은 알림
                  {query.data && (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {history.unreadCount}
                    </span>
                  )}
                </Tabs.Trigger>
              </Tabs.List>
              <Select
                value={filters.result}
                onValueChange={(value) => history.changeResult(value as NotificationType | "all")}
              >
                <SelectTrigger aria-label="작업 결과 필터" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 작업 결과</SelectItem>
                  <SelectItem value="WAVEFORM_SUCCEEDED">파형 생성 성공</SelectItem>
                  <SelectItem value="WAVEFORM_FAILED">파형 생성 실패</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <BrowserNotificationSwitch />
          </div>
          <Tabs.Content value={filters.view} className="min-w-0 space-y-4 outline-none">
            {(actions.read.isError || actions.all.isError) && (
              <p role="alert" className="text-destructive text-sm">
                읽음 처리를 완료하지 못했습니다. 다시 선택해 주세요.
              </p>
            )}
            {actions.selected.isError && selectedId && (
              <p role="alert" className="text-destructive text-sm">
                알림을 찾을 수 없습니다. 아래 내역을 확인해 주세요.
              </p>
            )}
            {query.isError && (
              <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
                <p>알림을 불러오지 못했습니다.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void query.refetch();
                  }}
                >
                  다시 시도
                </Button>
              </div>
            )}
            {(!query.isError || query.data) && (
              <NotificationTable
                items={history.items}
                totalCount={history.totalCount}
                pagination={history.pagination}
                onPaginationChange={history.changePagination}
                onOpen={actions.open}
                pending={actions.read.isPending || actions.all.isPending}
                loading={query.isPending}
                ready={!!query.data}
                hasFilter={filters.view !== "all" || filters.result !== "all"}
              />
            )}
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </section>
  );
}
