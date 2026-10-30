"use client";

import { useId, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { waveformMutations, waveformQueryKeys } from "@/entities/waveform";

import { ApiError } from "@/shared/api/http-errors";
import { Button } from "@/shared/ui/button";

export function WaveformImportButton({
  accountId,
  songId,
  videoId,
  disabled,
  videoChanged,
  onError,
}: {
  accountId: string;
  songId: string;
  videoId: string;
  disabled: boolean;
  videoChanged: boolean;
  onError: (error: unknown) => void;
}) {
  const noticeId = useId();
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const upload = useMutation({
    ...waveformMutations.import(accountId, songId, videoId),
    onError,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: waveformQueryKeys.all(accountId) });
    },
  });
  const blocked = disabled || videoChanged || upload.isPending;
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          aria-label="파형 JSON 파일"
          hidden
          disabled={blocked}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file && !blocked) upload.mutate(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocked}
          aria-describedby={noticeId}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? "파형 JSON 등록 중…" : "파형 JSON 등록"}
        </Button>
        {upload.data ? (
          <Link
            className="inline-flex min-h-8 items-center underline underline-offset-4"
            href={`/admin/waveform-jobs/${upload.data.id}`}
          >
            등록 결과 확인
          </Link>
        ) : null}
      </div>
      <p id={noticeId} className="text-muted-foreground">
        {videoChanged
          ? "참고 영상 변경을 저장하고 화면을 다시 열어주세요."
          : "로컬에서 생성한 JSON을 등록합니다. 기존 Cue 시각은 유지됩니다."}
      </p>
      {upload.isError ? (
        <p role="alert" className="text-destructive">
          {upload.error instanceof ApiError
            ? upload.error.message
            : "등록 결과를 확인하지 못했습니다. 같은 파일을 다시 등록해 확인할 수 있습니다."}
        </p>
      ) : null}
    </div>
  );
}
