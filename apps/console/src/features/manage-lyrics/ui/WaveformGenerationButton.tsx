"use client";

import { useId } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { waveformMutations, waveformQueryKeys } from "@/entities/waveform";

import { ApiError } from "@/shared/api/http-errors";
import { Button } from "@/shared/ui/button";

export function WaveformGenerationButton({
  accountId,
  songId,
  disabled,
  videoChanged,
  onError,
}: {
  accountId: string;
  songId: string;
  disabled: boolean;
  videoChanged: boolean;
  onError: (error: unknown) => void;
}) {
  const noticeId = useId();
  const queryClient = useQueryClient();
  const request = useMutation({
    ...waveformMutations.request(accountId),
    onError,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: waveformQueryKeys.all(accountId) });
    },
  });
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || videoChanged || request.isPending}
        aria-describedby={videoChanged ? noticeId : undefined}
        onClick={() => request.mutate(songId)}
      >
        {request.isPending ? "파형 생성 요청 중…" : "파형 생성"}
      </Button>
      {request.data ? (
        <Link
          className="inline-flex min-h-8 items-center underline underline-offset-4"
          href={`/admin/waveform-jobs/${request.data.jobId}`}
        >
          생성 결과 확인
        </Link>
      ) : null}
      {videoChanged ? (
        <p id={noticeId} className="text-muted-foreground">
          참고 영상 변경을 저장하고 화면을 다시 열어주세요.
        </p>
      ) : null}
      {request.isError ? (
        <p role="alert" className="text-destructive">
          {request.error instanceof ApiError
            ? request.error.message
            : "요청 결과를 확인하지 못했습니다. 다시 요청하면 진행 중인 작업을 확인합니다."}
        </p>
      ) : null}
    </div>
  );
}
