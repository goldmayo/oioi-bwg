"use client";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Clock3, Loader2, OctagonX, RefreshCw } from "lucide-react";
import Link from "next/link";

import { waveformQueries } from "@/entities/waveform";

import { Button } from "@/shared/ui/button";

import { useNotificationContext } from "../../../_ui/notification-provider";

const states = {
  QUEUED: {
    label: "대기 중",
    title: "파형 생성 순서를 기다리고 있습니다.",
    description: "결과가 준비되면 알림에서 확인할 수 있습니다.",
    icon: Clock3,
    color: "text-muted-foreground",
  },
  RUNNING: {
    label: "처리 중",
    title: "파형을 생성하고 있습니다.",
    description: "다른 작업을 계속해도 됩니다. 완료되면 알림에서 확인할 수 있습니다.",
    icon: Loader2,
    color: "text-sky-400",
  },
  SUCCEEDED: {
    label: "완료",
    title: "파형 생성을 완료했습니다.",
    description: "곡 편집 화면에서 작업을 이어갈 수 있습니다.",
    icon: CircleCheck,
    color: "text-emerald-400",
  },
  FAILED: {
    label: "실패",
    title: "파형을 생성하지 못했습니다.",
    description: "기존 가사는 계속 편집할 수 있습니다.",
    icon: OctagonX,
    color: "text-destructive",
  },
};
const reasons = {
  ENQUEUE_FAILED: "작업을 시작하지 못했습니다.",
  PROCESSING_FAILED: "파형 처리 중 오류가 발생했습니다.",
  DLQ: "작업 처리를 완료하지 못했습니다.",
  DELIVERY_EXPIRED: "처리 기한 내에 작업을 완료하지 못했습니다.",
  SOURCE_CHANGED: "작업 중 원본 영상이 변경되었습니다.",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );

export function WaveformJobStatus({ id }: { id: string }) {
  const { accountId } = useNotificationContext();
  const query = useQuery(waveformQueries.job(accountId, id));
  const state = query.data ? states[query.data.status] : null;
  const Icon = state?.icon ?? (query.isError ? OctagonX : Loader2);
  return (
    <div className="bg-card border-border overflow-hidden rounded-xl border">
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4" role={query.isError ? "alert" : "status"}>
          <span
            className={`bg-muted flex size-12 shrink-0 items-center justify-center rounded-xl ${state?.color ?? "text-muted-foreground"}`}
          >
            <Icon
              size={24}
              aria-hidden="true"
              className={
                query.isPending || query.data?.status === "RUNNING"
                  ? "animate-spin motion-reduce:animate-none"
                  : undefined
              }
            />
          </span>
          <div className="min-w-0">
            {state ? (
              <p className={`mb-2 text-sm font-medium ${state.color}`}>{state.label}</p>
            ) : null}
            <h2 className="text-lg leading-7 font-semibold">
              {query.isPending
                ? "작업 결과를 불러오고 있습니다."
                : query.isError
                  ? "작업 결과를 불러오지 못했습니다."
                  : state?.title}
            </h2>
            <p className="text-muted-foreground mt-2 max-w-prose text-sm leading-7">
              {query.isError
                ? "작업이 삭제됐거나 조회할 수 없습니다. 다시 조회하거나 알림 내역을 확인해 주세요."
                : state?.description}
            </p>
          </div>
        </div>
        {query.data?.errorCode ? (
          <p className="text-muted-foreground bg-muted/60 mt-6 rounded-lg px-4 py-3 text-sm leading-6">
            {reasons[query.data.errorCode]}
          </p>
        ) : null}
        {query.data ? (
          <dl className="border-border mt-8 grid gap-5 border-t pt-6 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">요청 시각</dt>
              <dd className="mt-2 font-medium tabular-nums">
                <time dateTime={query.data.createdAt}>{date(query.data.createdAt)}</time>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">종료 시각</dt>
              <dd className="mt-2 font-medium tabular-nums">
                {query.data.finishedAt ? (
                  <time dateTime={query.data.finishedAt}>{date(query.data.finishedAt)}</time>
                ) : (
                  "처리 대기 중"
                )}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
      <div className="border-border bg-muted/30 flex flex-wrap items-center gap-3 border-t px-6 py-5 sm:px-8">
        {query.data?.editorHref ? (
          <Button asChild className="max-sm:w-full">
            <Link href={query.data.editorHref}>가사 편집으로 돌아가기</Link>
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          새로고침
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/notifications">알림 내역</Link>
        </Button>
      </div>
    </div>
  );
}
