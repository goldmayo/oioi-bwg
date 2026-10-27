"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { waveformQueries } from "@/entities/waveform";

import { Button } from "@/shared/ui/button";

import { useNotificationContext } from "../../../_ui/notification-provider";
const labels = {
  QUEUED: "파형 생성 순서를 기다리고 있습니다.",
  RUNNING: "파형을 생성하고 있습니다. 다른 작업을 계속해도 됩니다.",
  SUCCEEDED: "파형 생성을 완료했습니다.",
  FAILED: "파형을 생성하지 못했습니다. 기존 가사는 계속 편집할 수 있습니다.",
};
export function WaveformJobStatus({ id }: { id: string }) {
  const { accountId } = useNotificationContext();
  const query = useQuery(waveformQueries.job(accountId, id));
  return (
    <div className="space-y-4">
      <p role={query.isError ? "alert" : "status"} className="text-muted-foreground text-sm">
        {query.isPending
          ? "작업 결과를 불러오고 있습니다."
          : query.isError
            ? "작업 결과를 불러오지 못했습니다. 작업이 삭제됐거나 조회할 수 없습니다."
            : labels[query.data.status]}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
        >
          새로고침
        </Button>
        {query.data?.editorHref ? (
          <Button asChild>
            <Link href={query.data.editorHref}>가사 편집으로 돌아가기</Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost">
          <Link href="/admin/notifications">알림 내역</Link>
        </Button>
      </div>
    </div>
  );
}
