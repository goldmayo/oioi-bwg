import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";

import { ApiError, ClientContractError } from "@/shared/api/http-errors";

import {
  getNotificationHistory,
  getNotifications,
  readAllNotifications,
  registerPushInstallation,
  unregisterPushInstallation,
} from "./api";
import { notificationQueries } from "./queries";

const server = createHttpTestServer(window.location.href);
const id = "019a0170-0000-7000-8000-000000000001";

it("알림 cursor와 이력 필터를 인코딩하고 계정별 query key를 구분한다", async () => {
  const urls: URL[] = [];
  server.use(
    http.get("*/api/admin/notifications", ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json({ items: [], nextCursor: id, unreadCount: 0 });
    }),
    http.get("*/api/admin/notifications/history", ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json({ items: [], totalCount: 0, unreadCount: 0 });
    }),
  );
  const page = await getNotifications("cursor / +");
  const input = { limit: 10, offset: 20, status: "unread", type: "WAVEFORM_FAILED" } as const;
  await expect(getNotificationHistory(input)).resolves.toEqual({
    items: [],
    totalCount: 0,
    unreadCount: 0,
  });
  expect(urls.map(({ searchParams }) => Object.fromEntries(searchParams))).toEqual([
    { limit: "20", cursor: "cursor / +" },
    { limit: "10", offset: "20", status: "unread", type: "WAVEFORM_FAILED" },
  ]);
  expect(notificationQueries.list("a").getNextPageParam?.(page, [], undefined, [])).toBe(id);
  expect(notificationQueries.list("a").queryKey).not.toEqual(
    notificationQueries.list("b").queryKey,
  );
  expect(notificationQueries.history("a", input).queryKey).not.toEqual(
    notificationQueries.history("a", { ...input, offset: 0 }).queryKey,
  );
});

it("본문 없는 읽음·해제 응답과 설치 등록 JSON을 실제 HTTP로 처리한다", async () => {
  const bodies: unknown[] = [];
  server.use(
    http.post("*/api/admin/notifications/read-all", () => new HttpResponse(null, { status: 204 })),
    http.put("*/api/admin/push-installations", async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({ id });
    }),
    http.delete(
      "*/api/admin/push-installations/:id",
      () => new HttpResponse(null, { status: 204 }),
    ),
  );
  await expect(readAllNotifications()).resolves.toBeUndefined();
  await expect(registerPushInstallation("fixture-installation")).resolves.toEqual({ id });
  await expect(unregisterPushInstallation(id)).resolves.toBeUndefined();
  expect(bodies).toEqual([{ fid: "fixture-installation" }]);
});

it("깨진 성공 payload와 권한 오류를 구분하고 취소 signal을 전달한다", async () => {
  server.use(http.get("*/api/admin/notifications", () => HttpResponse.json({ invalid: true })));
  await expect(getNotifications()).rejects.toBeInstanceOf(ClientContractError);
  server.use(
    http.get("*/api/admin/notifications", () =>
      HttpResponse.json({ code: "FORBIDDEN", message: "접근 권한이 없습니다." }, { status: 403 }),
    ),
  );
  await expect(getNotifications()).rejects.toBeInstanceOf(ApiError);
  const controller = new AbortController();
  controller.abort();
  await expect(getNotifications(undefined, controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
});
