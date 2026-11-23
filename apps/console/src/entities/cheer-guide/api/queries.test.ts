import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import { QueryClient } from "@tanstack/react-query";
import { http as handlers, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";

import { http } from "@/shared/api/http-client";

import { cheerGuideQueries } from "./queries";
import { cheerGuideQueryKeys } from "./query-keys";

const server = createHttpTestServer(window.location.href);

it("RSC와 같은 key를 사용하고 요청 취소 signal과 응답 검증을 보존한다", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(http, "get");
  server.use(
    handlers.get(
      "*/api/admin/cheer-guides",
      () => HttpResponse.json({ items: [], nextCursor: null }),
      { once: true },
    ),
    handlers.get("*/api/admin/cheer-guides", () =>
      HttpResponse.json({ items: [{ id: "invalid" }], nextCursor: null }),
    ),
  );
  expect(cheerGuideQueries.adminList().queryKey).toEqual(cheerGuideQueryKeys.adminList());
  await expect(client.fetchQuery(cheerGuideQueries.adminList())).resolves.toEqual({
    items: [],
    nextCursor: null,
  });
  expect(http.get).toHaveBeenCalledWith("/api/admin/cheer-guides", {
    signal: expect.any(AbortSignal),
  });
  await expect(
    client.fetchQuery({ ...cheerGuideQueries.adminList(), staleTime: 0 }),
  ).rejects.toThrow("API response contract violation");
  client.clear();
});
