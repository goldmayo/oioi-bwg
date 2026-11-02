import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/shared/api/http-client", () => ({ http }));

import { cheerGuideQueries } from "./queries";
import { cheerGuideQueryKeys } from "./query-keys";

it("RSC와 같은 key를 사용하고 요청 취소 signal과 응답 검증을 보존한다", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  http.get
    .mockResolvedValueOnce({ items: [], nextCursor: null })
    .mockResolvedValueOnce({ items: [{ id: "invalid" }], nextCursor: null });
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
