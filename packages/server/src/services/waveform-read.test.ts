import { beforeEach, expect, it, vi } from "vitest";
import { createMongoAbility } from "@casl/ability";
import type { RequestContext } from "../auth/request-context";
const mocks = vi.hoisted(() => ({ find: vi.fn(), db: {} }));
vi.mock("../db", () => ({ getDatabase: () => mocks.db }));
vi.mock("../repositories/waveform-repository", () => ({ findSongWaveform: mocks.find }));
vi.mock("./notification-service", () => ({ recordWaveformNotification: vi.fn() }));
import { getSongWaveform } from "./waveform-service";
const context = (rules: unknown[], user: unknown = { id: "admin" }) =>
  ({ user, ability: createMongoAbility(rules as never) }) as RequestContext;
beforeEach(() => {
  vi.clearAllMocks();
});
it("관리자만 조회하고 권한 거부 시 DB에 접근하지 않는다", async () => {
  await expect(getSongWaveform(context([], null), "song")).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  await expect(getSongWaveform(context([]), "song")).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mocks.find).not.toHaveBeenCalled();
});
it("현재 영상의 JSON만 반환하고 파형 부재와 삭제된 곡을 구분한다", async () => {
  const ctx = context([{ action: "manage", subject: "all" }]);
  const data = { source: { id: "abcdefghijk" } };
  mocks.find.mockResolvedValueOnce({ videoId: "abcdefghijk", data });
  expect(await getSongWaveform(ctx, "song")).toEqual(data);
  mocks.find.mockResolvedValueOnce({ videoId: "other-video", data });
  expect(await getSongWaveform(ctx, "song")).toBeNull();
  mocks.find.mockResolvedValueOnce({ videoId: "abcdefghijk", data: null });
  expect(await getSongWaveform(ctx, "song")).toBeNull();
  mocks.find.mockResolvedValueOnce(undefined);
  await expect(getSongWaveform(ctx, "song")).rejects.toMatchObject({ code: "SONG_NOT_FOUND" });
});
