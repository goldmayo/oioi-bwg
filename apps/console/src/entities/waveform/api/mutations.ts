"use client";

import { waveformDataSchema, waveformJobSchema } from "@oioi-bwg/contracts/waveform";
import { mutationOptions } from "@tanstack/react-query";

import { http } from "@/shared/api/http-client";
import { ApiError, parseClientResponse } from "@/shared/api/http-errors";

export const waveformMutations = {
  import: (accountId: string, songId: string, videoId: string) =>
    mutationOptions({
      mutationKey: ["waveform-import", accountId, songId],
      mutationFn: async (file: File) => {
        let value: unknown;
        try {
          if (file.size > 4 * 1024 * 1024) throw new Error("size");
          value = JSON.parse(await file.text()) as unknown;
        } catch {
          throw new ApiError(400, {
            code: "VALIDATION_ERROR",
            message: "4MiB 이하의 파형 JSON 파일을 선택해 주세요.",
          });
        }
        const parsed = waveformDataSchema.safeParse(value);
        if (!parsed.success)
          throw new ApiError(400, {
            code: "VALIDATION_ERROR",
            message: "파형 JSON 형식을 확인해 주세요. 로컬 생성 명령의 결과 파일이 필요합니다.",
          });
        if (parsed.data.source.id !== videoId)
          throw new ApiError(400, {
            code: "WAVEFORM_SOURCE_INVALID",
            message: "현재 참고 영상과 다른 파형입니다.",
          });
        return parseClientResponse(
          waveformJobSchema,
          await http.put(`/api/admin/songs/${songId}/waveform`, { json: parsed.data }),
        );
      },
      retry: false,
      meta: { skipGlobalError: true },
    }),
};
