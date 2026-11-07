"use client";

import { type AnalyticsInput, analyticsReportSchema } from "@oioi-bwg/contracts/analytics";
import { queryOptions } from "@tanstack/react-query";

import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";

/** GA4 속성의 서울 시간 오후 5시를 다음 자동 갱신 시각으로 사용한다. */
function nextRefresh(at: number) {
  const next = new Date(at);
  next.setUTCHours(8, 0, 0, 0);
  if (next.getTime() <= at) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}

export function analyticsQuery(accountId: string, input: AnalyticsInput) {
  return queryOptions({
    queryKey: ["analytics", accountId, input],
    queryFn: async ({ signal }) =>
      parseClientResponse(
        analyticsReportSchema,
        await http.get(`/api/admin/analytics?${new URLSearchParams(input)}`, {
          signal,
          timeout: 30_000,
        }),
      ),
    staleTime: (query) =>
      Math.max(0, nextRefresh(query.state.dataUpdatedAt) - query.state.dataUpdatedAt),
    refetchInterval: () => Math.max(1_000, nextRefresh(Date.now()) - Date.now()),
    refetchOnWindowFocus: true,
    retry: false,
  });
}
