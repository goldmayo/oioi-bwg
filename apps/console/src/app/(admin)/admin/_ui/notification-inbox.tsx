"use client";
import { useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ChevronRight, CircleCheck, Loader2, OctagonX } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  notificationQueries,
  notificationQueryKeys,
  readAllNotifications,
  readNotification,
} from "@/entities/notification";

import { Button } from "@/shared/ui/button";

import { useNotificationContext } from "./notification-provider";

export function NotificationInbox({
  onNavigate,
  selectedId,
}: {
  onNavigate?: () => void;
  selectedId?: string;
}) {
  const { accountId, pushState, enable, disable } = useNotificationContext();
  const client = useQueryClient();
  const router = useRouter();
  const list = useInfiniteQuery(notificationQueries.list(accountId));
  const selected = useQuery({
    ...notificationQueries.detail(accountId, selectedId ?? ""),
    enabled: Boolean(selectedId),
  });
  const processed = useRef<string | null>(null);
  const invalidate = () =>
    client.invalidateQueries({ queryKey: notificationQueryKeys.all(accountId) });
  const all = useMutation({ mutationFn: readAllNotifications, onSuccess: invalidate });
  const {
    mutateAsync: read,
    isPending,
    isError: readError,
  } = useMutation({
    mutationFn: readNotification,
    onSuccess: invalidate,
  });
  const count = list.data?.pages[0]?.unreadCount ?? 0;
  useEffect(() => {
    const item = selected.data;
    if (!item || processed.current === item.id) return;
    processed.current = item.id;
    void read(item.id)
      .then(() => {
        router.replace(item.href);
      })
      .catch(() => {
        processed.current = null;
      });
  }, [read, router, selected.data]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
        <span className="text-foreground text-sm font-medium">읽지 않은 알림 {count}개</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!count || all.isPending}
          onClick={() => all.mutate()}
        >
          <CheckCheck aria-hidden="true" size={16} />
          모두 읽음
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={list.isPending}>
        {readError || all.isError ? (
          <p role="alert" className="text-destructive p-4 text-sm">
            읽음 처리를 완료하지 못했습니다. 다시 선택해 주세요.
          </p>
        ) : null}
        {selected.isError && selectedId ? (
          <p role="alert" className="p-4 text-sm">
            알림을 찾을 수 없습니다. 아래 내역을 확인해 주세요.
          </p>
        ) : null}
        {list.isPending ? (
          <div
            role="status"
            className="text-muted-foreground flex justify-center gap-2 p-8 text-sm"
          >
            <Loader2 className="animate-spin" size={16} />
            알림을 불러오고 있습니다.
          </div>
        ) : list.isError ? (
          <div role="alert" className="space-y-3 p-6 text-center text-sm">
            <p>알림을 불러오지 못했습니다.</p>
            <Button
              variant="outline"
              onClick={() => {
                void list.refetch();
              }}
            >
              다시 시도
            </Button>
          </div>
        ) : list.data?.pages[0]?.items.length === 0 ? (
          <div className="text-muted-foreground px-6 py-16 text-center">
            <Bell className="mx-auto mb-4 size-8" aria-hidden="true" />
            <p className="text-foreground font-medium">아직 알림이 없습니다.</p>
            <p className="mt-2 text-sm">진행한 작업의 결과를 여기에서 확인할 수 있습니다.</p>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {list.data?.pages
              .flatMap((page) => page.items)
              .map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="hover:bg-accent/40 focus-visible:ring-ring flex w-full items-start gap-3 px-5 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:opacity-60"
                    disabled={isPending}
                    onClick={() => {
                      void read(item.id)
                        .then(() => {
                          onNavigate?.();
                          router.push(item.href);
                        })
                        .catch(() => {});
                    }}
                  >
                    <span
                      className={`bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg ${item.type === "WAVEFORM_FAILED" ? "text-destructive" : "text-emerald-400"}`}
                      aria-hidden="true"
                    >
                      {item.type === "WAVEFORM_FAILED" ? (
                        <OctagonX size={18} />
                      ) : (
                        <CircleCheck size={18} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm leading-6 ${item.readAt ? "text-muted-foreground" : "text-foreground font-semibold"}`}
                      >
                        {item.title}
                      </span>
                      <time
                        dateTime={item.createdAt}
                        className="text-muted-foreground mt-1.5 block text-xs"
                      >
                        {new Intl.DateTimeFormat("ko-KR", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(item.createdAt))}
                      </time>
                    </span>
                    <span
                      className={`mt-2 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-primary"}`}
                      aria-label={item.readAt ? "읽음" : "읽지 않음"}
                    />
                    <ChevronRight
                      className="text-muted-foreground mt-1 size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
          </ul>
        )}
        {list.hasNextPage ? (
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full"
              disabled={list.isFetchingNextPage}
              onClick={() => {
                void list.fetchNextPage();
              }}
            >
              {list.isFetchingNextPage ? "불러오는 중…" : "이전 알림 더 보기"}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="border-border bg-muted/30 border-t px-5 py-4">
        {pushState === "denied" ? (
          <p className="text-muted-foreground text-xs">
            브라우저 설정에서 알림을 허용하면 작업 결과를 받아볼 수 있습니다.
          </p>
        ) : pushState === "unavailable" || pushState === "unsupported" ? (
          <p className="text-muted-foreground text-xs">
            브라우저 알림을 사용할 수 없습니다. 결과는 알림함에서 확인할 수 있습니다.
          </p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pushState === "loading"}
            onClick={() => {
              void (pushState === "enabled" ? disable() : enable()).catch(() => {});
            }}
          >
            {pushState === "loading"
              ? "알림 설정 중…"
              : pushState === "enabled"
                ? "브라우저 알림 끄기"
                : "브라우저 알림 켜기"}
          </Button>
        )}
      </div>
    </div>
  );
}
