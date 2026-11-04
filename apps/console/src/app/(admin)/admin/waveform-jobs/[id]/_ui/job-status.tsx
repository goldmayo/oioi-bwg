"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleCheck, Clock3, Loader2, OctagonX, RefreshCw } from "lucide-react";

import { waveformQueries } from "@/entities/waveform";

import { adminLinks } from "@/shared/config/admin-routes";
import { Button } from "@/shared/ui/button";

import { useNotificationContext } from "../../../_ui/notification-provider";

const states = {
  QUEUED: {
    title: "파형 생성 순서를 기다리고 있습니다.",
    description: "결과가 준비되면 알림에서 확인할 수 있습니다.",
    icon: Clock3,
    color: "text-muted-foreground",
  },
  RUNNING: {
    title: "파형을 생성하고 있습니다.",
    description: "다른 작업을 계속해도 됩니다. 완료되면 알림에서 확인할 수 있습니다.",
    icon: Loader2,
    color: "text-muted-foreground",
  },
  SUCCEEDED: {
    title: "파형 생성을 완료했습니다.",
    description: "곡 정보에서 편집할 응원법을 확인할 수 있습니다.",
    icon: CircleCheck,
    color: "text-success",
  },
  FAILED: {
    title: "파형을 생성하지 못했습니다.",
    description: "기존 가사는 계속 편집할 수 있습니다.",
    icon: OctagonX,
    color: "text-destructive",
  },
};
const loading = {
  title: "작업 결과를 불러오고 있습니다.",
  description: null,
  icon: Loader2,
  color: "text-muted-foreground",
};
const loadError = {
  title: "작업 결과를 불러오지 못했습니다.",
  description: "상태를 새로고침하거나 알림 내역으로 돌아가 주세요.",
  icon: OctagonX,
  color: "text-destructive",
};
const reasons = {
  ENQUEUE_FAILED: "작업을 시작하지 못했습니다.",
  PROCESSING_FAILED: "파형 처리 중 오류가 발생했습니다.",
  DLQ: "작업 처리를 완료하지 못했습니다.",
  DELIVERY_EXPIRED: "처리 기한 내에 작업을 완료하지 못했습니다.",
  SOURCE_CHANGED: "작업 중 원본 영상이 변경되었습니다.",
};
const date = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

export function WaveformJobStatus({ id }: { id: string }) {
  const { accountId } = useNotificationContext();
  const query = useQuery(waveformQueries.job(accountId, id));
  const job = query.data;
  let state = job ? states[job.status] : loading;
  if (query.isError) state = loadError;
  const Icon = state.icon;
  const reason = !query.isError && job?.errorCode ? reasons[job.errorCode] : null;

  return (
    <div className="bg-card rounded-xl p-6">
      <div role={query.isError ? "alert" : "status"}>
        <div className="flex items-center gap-2.5">
          <Icon
            size={20}
            aria-hidden="true"
            className={`shrink-0 ${state.color} ${state === loading || state === states.RUNNING ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          <h2 className="text-lg leading-7 font-semibold">{state.title}</h2>
        </div>
        {reason ? <p className="mt-3 text-sm leading-6">{reason}</p> : null}
        {state.description ? (
          <p className={`text-muted-foreground text-sm leading-6 ${reason ? "" : "mt-3"}`}>
            {state.description}
          </p>
        ) : null}
      </div>

      {job ? (
        <dl className="border-border my-6 divide-y border-y text-sm sm:flex sm:divide-y-0">
          <div className="flex items-center justify-between gap-3 py-3 sm:flex-1 sm:justify-start">
            <dt className="text-muted-foreground shrink-0">요청 시각</dt>
            <dd className="text-right tabular-nums">
              <time dateTime={job.createdAt}>{date.format(new Date(job.createdAt))}</time>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3 sm:flex-1 sm:justify-start">
            <dt className="text-muted-foreground shrink-0">종료 시각</dt>
            <dd className="text-right tabular-nums">
              {job.finishedAt ? (
                <time dateTime={job.finishedAt}>{date.format(new Date(job.finishedAt))}</time>
              ) : (
                "아직 종료되지 않음"
              )}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className={`grid gap-2 sm:flex sm:gap-3 ${job ? "" : "mt-6"}`}>
        {job ? (
          <Button asChild className="min-h-11">
            <a href={adminLinks.song(job.songId)}>
              곡 정보 보기 <ArrowRight size={16} aria-hidden="true" />
            </a>
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="text-muted-foreground min-h-11"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          상태 새로고침
        </Button>
      </div>
    </div>
  );
}
