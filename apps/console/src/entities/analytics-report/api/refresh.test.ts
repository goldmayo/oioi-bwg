import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

import { analyticsQuery } from "./queries";

afterEach(() => vi.restoreAllMocks());
const input = { report: "summary", from: "2026-11-01", to: "2026-11-23" } as const;

it.each([
  ["2026-11-23T16:59:59.000+09:00", 1_000, 1_000],
  ["2026-11-23T16:59:59.999+09:00", 1, 1_000],
  ["2026-11-23T17:00:00.000+09:00", 86_400_000, 86_400_000],
  ["2026-11-23T17:00:00.001+09:00", 86_399_999, 86_399_999],
  ["2026-11-30T23:59:59.000+09:00", 61_201_000, 61_201_000],
  ["2026-12-31T17:00:00.000+09:00", 86_400_000, 86_400_000],
] as const)("%s의 다음 서울 17시와 최소 자동 갱신 간격을 지킨다", (timestamp, stale, interval) => {
  const at = Date.parse(timestamp);
  vi.spyOn(Date, "now").mockReturnValue(at);
  const client = new QueryClient();
  const options = analyticsQuery("admin", input);
  const query = client
    .getQueryCache()
    .build(client, { ...options, queryKey: [...options.queryKey] });
  query.setState({ dataUpdatedAt: at });
  try {
    if (typeof options.staleTime !== "function" || typeof options.refetchInterval !== "function")
      throw new Error("동적 갱신 정책이 필요합니다.");
    expect(options.staleTime(query)).toBe(stale);
    expect(options.refetchInterval(query)).toBe(interval);
  } finally {
    client.clear();
  }
});
