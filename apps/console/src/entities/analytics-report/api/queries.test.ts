import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";

import { ApiError, ClientContractError } from "@/shared/api/http-errors";

import { analyticsQuery } from "./queries";

const server = createHttpTestServer(window.location.href);
const input = { report: "summary", from: "2026-11-01", to: "2026-11-23" } as const;
const report = {
  ...input,
  fetchedAt: "2026-11-23T08:00:00.000Z",
  timeZone: "Asia/Seoul",
  totals: { users: 0, sessions: 0, views: 0 },
  rows: [],
  thresholded: false,
  sampled: false,
  truncated: false,
};

it("기간·보고서 입력을 직렬화하고 계정·조건별 조회를 구분한다", async () => {
  const urls: URL[] = [];
  server.use(
    http.get("*/api/admin/analytics", ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json(report);
    }),
  );
  const client = new QueryClient();
  try {
    await expect(client.fetchQuery(analyticsQuery("admin-a", input))).resolves.toEqual(report);
    expect(Object.fromEntries(urls[0].searchParams)).toEqual(input);
    expect(analyticsQuery("admin-a", input).queryKey).not.toEqual(
      analyticsQuery("admin-b", input).queryKey,
    );
    expect(analyticsQuery("admin-a", input).queryKey).not.toEqual(
      analyticsQuery("admin-a", { ...input, report: "trend" }).queryKey,
    );
  } finally {
    client.clear();
  }
});

it("깨진 응답과 HTTP 오류를 구분하며 실패를 재시도하지 않는다", async () => {
  const client = new QueryClient();
  let calls = 0;
  server.use(
    http.get("*/api/admin/analytics", () => {
      calls++;
      return HttpResponse.json({ invalid: true });
    }),
  );
  try {
    await expect(client.fetchQuery(analyticsQuery("a", input))).rejects.toBeInstanceOf(
      ClientContractError,
    );
    server.use(
      http.get("*/api/admin/analytics", () => {
        calls++;
        return HttpResponse.json(
          { code: "FORBIDDEN", message: "접근 권한이 없습니다." },
          { status: 403 },
        );
      }),
    );
    await expect(client.fetchQuery(analyticsQuery("a", input))).rejects.toBeInstanceOf(ApiError);
    expect(calls).toBe(2);
  } finally {
    client.clear();
  }
});
