import { expect, it, vi } from "vitest";

import { waveformQueries, waveformQueryKeys } from "./queries";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/shared/api/http-client", () => ({ http: { get: mocks.get } }));
it("JSON 조회는 계정별 곡 키와 취소 signal을 사용하고 빈 결과를 허용한다", async () => {
  const options = waveformQueries.song("admin-a", "song");
  expect(options.queryKey).toEqual(waveformQueryKeys.song("admin-a", "song"));
  expect(options.queryKey).not.toEqual(waveformQueries.song("admin-b", "song").queryKey);
  const signal = new AbortController().signal;
  mocks.get.mockResolvedValueOnce(null);
  const queryFn = options.queryFn as (input: { signal: AbortSignal }) => Promise<unknown>;
  expect(await queryFn({ signal })).toBeNull();
  expect(mocks.get).toHaveBeenCalledWith("/api/admin/songs/song/waveform", { signal });
  mocks.get.mockResolvedValueOnce({ peaks: [] });
  await expect(queryFn({ signal })).rejects.toMatchObject({ name: "ClientContractError" });
});
