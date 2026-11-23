import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import { http as handlers, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";

import { http } from "@/shared/api/http-client";

import { waveformQueries, waveformQueryKeys } from "./queries";
const server = createHttpTestServer(window.location.href);
it("JSON 조회는 계정별 곡 키와 취소 signal을 사용하고 빈 결과를 허용한다", async () => {
  const options = waveformQueries.song("admin-a", "song");
  expect(options.queryKey).toEqual(waveformQueryKeys.song("admin-a", "song"));
  expect(options.queryKey).not.toEqual(waveformQueries.song("admin-b", "song").queryKey);
  const signal = new AbortController().signal;
  vi.spyOn(http, "get");
  server.use(
    handlers.get("*/api/admin/songs/song/waveform", () => HttpResponse.json(null), { once: true }),
    handlers.get("*/api/admin/songs/song/waveform", () => HttpResponse.json({ peaks: [] })),
  );
  const queryFn = options.queryFn as (input: { signal: AbortSignal }) => Promise<unknown>;
  expect(await queryFn({ signal })).toBeNull();
  expect(http.get).toHaveBeenCalledWith("/api/admin/songs/song/waveform", { signal });
  await expect(queryFn({ signal })).rejects.toMatchObject({ name: "ClientContractError" });
});
