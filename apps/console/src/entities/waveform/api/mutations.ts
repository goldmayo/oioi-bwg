"use client";

import { waveformAcceptedSchema, waveformRequestSchema } from "@oioi-bwg/contracts/waveform";
import { mutationOptions } from "@tanstack/react-query";

import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";

export const waveformMutations = {
  request: (accountId: string) =>
    mutationOptions({
      mutationKey: ["waveform-request", accountId],
      mutationFn: async (songId: string) =>
        parseClientResponse(
          waveformAcceptedSchema,
          await http.post("/api/admin/waveform-jobs", {
            json: waveformRequestSchema.parse({ songId }),
          }),
        ),
      retry: false,
      meta: { skipGlobalError: true },
    }),
};
