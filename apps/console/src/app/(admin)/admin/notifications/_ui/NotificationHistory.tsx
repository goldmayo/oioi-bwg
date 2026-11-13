"use client";

import type { NotificationType } from "@oioi-bwg/contracts/notification";
import { CheckCheck, Settings, X } from "lucide-react";
import { Tabs } from "radix-ui";

import { useMediaQuery } from "@/shared/model/useMediaQuery";
import { Button } from "@/shared/ui/button";
import { ListFilterSheet } from "@/shared/ui/list-filter-sheet";
import { ListHeader } from "@/shared/ui/list-layout";
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

import { BrowserNotificationSwitch } from "../../_ui/browser-notification-switch";
import { useNotificationContext } from "../../_ui/notification-provider";
import { useNotificationHistory } from "../_model/use-notification-history";

import { NotificationTable } from "./NotificationTable";

const tabClass =
  "text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground focus-visible:outline-ring h-11 shrink-0 rounded px-2.5 md:h-7 md:px-3 text-sm font-medium whitespace-nowrap outline-none hover:text-foreground focus-visible:outline-2";
export function NotificationHistory({ selectedId }: { selectedId?: string }) {
  const wide = useMediaQuery("(min-width: 768px)");
  const { accountId } = useNotificationContext();
  const history = useNotificationHistory(accountId, selectedId);
  const { actions, filters, query } = history;
  const markAllDisabled = !history.unreadCount || actions.all.isPending || query.isPending;
  const markAllRead = () => actions.all.mutate();
  return (
    <section className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-3 md:space-y-4">
        <ListHeader
          title="알림 내역"
          compactOnMobile
          description="작업 결과와 놓친 알림을 확인합니다."
          action={
            wide ? (
              <Button variant="secondary" disabled={markAllDisabled} onClick={markAllRead}>
                <CheckCheck className="size-4" />
                모두 읽음
              </Button>
            ) : (
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 md:hidden"
                    aria-label="알림 설정"
                  >
                    <Settings aria-hidden="true" className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  showCloseButton={false}
                  className="bg-popover max-h-dvh overflow-y-auto rounded-t-xl px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                >
                  <SheetHeader className="p-0 pr-12 text-left">
                    <SheetTitle>알림 설정</SheetTitle>
                    <SheetDescription>
                      파형 작업이 끝나면 이 브라우저로 알림을 받습니다.
                    </SheetDescription>
                  </SheetHeader>
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 size-11"
                      aria-label="알림 설정 닫기"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </SheetClose>
                  <BrowserNotificationSwitch inSheet />
                </SheetContent>
              </Sheet>
            )
          }
        />
        <Tabs.Root
          value={filters.view}
          onValueChange={(value) => history.changeView(value as "all" | "unread")}
          className="space-y-3 md:space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 md:w-auto md:justify-start">
              <Tabs.List
                aria-label="알림 모아보기"
                className="bg-muted inline-flex h-11 shrink-0 items-center gap-1 rounded-md px-1 md:h-9 md:p-1"
              >
                <Tabs.Trigger value="all" className={tabClass}>
                  {wide ? "전체 알림" : "전체"}
                </Tabs.Trigger>
                <Tabs.Trigger value="unread" className={`${tabClass} flex items-center gap-2`}>
                  {wide ? "안 읽은 알림" : "안 읽음"}
                  {query.data && (
                    <span className="bg-card md:text-muted-foreground min-w-5 rounded px-1 text-center text-xs leading-5 tabular-nums md:bg-transparent md:px-0">
                      {history.unreadCount}
                    </span>
                  )}
                </Tabs.Trigger>
              </Tabs.List>
              <ListFilterSheet
                title="알림 필터"
                description="파형 생성 결과로 알림 내역을 좁힙니다."
                activeCount={filters.result === "all" ? 0 : 1}
              >
                <div className="grid gap-1.5">
                  <span className="text-muted-foreground text-xs">작업 결과</span>
                  <Select
                    value={filters.result}
                    onValueChange={(value) =>
                      history.changeResult(value as NotificationType | "all")
                    }
                  >
                    <SelectTrigger
                      aria-label="작업 결과 필터"
                      className="w-full data-[size=default]:h-11"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 결과</SelectItem>
                      <SelectItem value="WAVEFORM_SUCCEEDED">파형 생성 성공</SelectItem>
                      <SelectItem value="WAVEFORM_FAILED">파형 생성 실패</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </ListFilterSheet>
            </div>
            {wide ? <BrowserNotificationSwitch /> : null}
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
                mobileAction={
                  wide ? undefined : (
                    <Button
                      variant="ghost"
                      className="decoration-muted-foreground/60 h-11 px-2 underline underline-offset-4 disabled:no-underline"
                      disabled={markAllDisabled}
                      onClick={markAllRead}
                    >
                      모두 읽음
                    </Button>
                  )
                }
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
