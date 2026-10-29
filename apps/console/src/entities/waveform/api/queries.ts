"use client";
import { waveformDataSchema, waveformJobSchema } from "@oioi-bwg/contracts/waveform";
import { queryOptions } from "@tanstack/react-query";

import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";
export const waveformQueryKeys = {
  all: (accountId: string) => ["waveform", accountId] as const,
  song: (accountId: string, songId: string) => ["waveform", accountId, "song", songId] as const,
};
export const waveformQueries = {
  song: (accountId: string, songId: string) =>
    queryOptions({
      queryKey: waveformQueryKeys.song(accountId, songId),
      queryFn: async ({ signal }) =>
        parseClientResponse(
          waveformDataSchema.nullable(),
          await http.get(`/api/admin/songs/${songId}/waveform`, { signal }),
        ),
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
    }),
  job: (accountId: string, id: string) =>
    queryOptions({
      queryKey: [...waveformQueryKeys.all(accountId), id],
      queryFn: async ({ signal }) =>
        parseClientResponse(
          waveformJobSchema,
          await http.get(`/api/admin/waveform-jobs/${id}`, { signal }),
        ),
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
    }),
};
