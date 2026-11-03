import { beforeEach, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => vi.fn((work: (tx: object) => Promise<unknown>) => work({})));
const database = vi.hoisted(() => vi.fn(() => ({ transaction })));
const lock = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
const snapshot = vi.hoisted(() => vi.fn());
const setWorking = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ getDatabase: database }));
vi.mock("../repositories/cheer-guide-repository", () => ({
  lockSongForGuideWrite: lock,
  insertGuideDraft: insert,
  insertNextGuideSnapshot: snapshot,
  setGuideWorkingSnapshot: setWorking,
}));
import { createAdminCheerGuide } from "./cheer-guide-service";

const id = "019a0170-0000-7000-8000-000000000001";
const context = { user: { id }, ability: { cannot: () => false } } as never;
const input = {
  songId: id,
  mode: "CONCERT",
  sourceType: "FANDOM",
  sourceUrl: null,
  guideVideoUrl: null,
  description: null,
} as const;
beforeEach(() => {
  vi.clearAllMocks();
  lock.mockResolvedValue({ youtubeId: "server-video", lyrics: [] });
  insert.mockResolvedValue({ id });
  snapshot.mockResolvedValue({ id });
});
it("인증·인가를 DB 획득 전에 검사한다", async () => {
  await expect(createAdminCheerGuide({ user: null } as never, input)).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  await expect(
    createAdminCheerGuide({ user: { id }, ability: { cannot: () => true } } as never, input),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(database).not.toHaveBeenCalled();
});
it("기준 영상·가사·작성자를 서버에서 가져오고 공개 조치 없이 하나의 transaction으로 저장한다", async () => {
  expect(await createAdminCheerGuide(context, input)).toEqual({ id });
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(setWorking).toHaveBeenCalledWith({}, id, id);
  expect(insert).toHaveBeenCalledWith({}, { songId: id, mode: "CONCERT" });
  expect(snapshot).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      createdByAccountId: id,
      referenceYoutubeId: "server-video",
      lyrics: [],
    }),
  );
});
it.each([
  [undefined, "SONG_NOT_FOUND"],
  [{ youtubeId: " ", lyrics: [] }, "CHEER_GUIDE_SOURCE_INVALID"],
  [{ youtubeId: "video", lyrics: {} }, "SONG_LYRICS_INVALID"],
])("잘못된 기준 곡은 Guide 삽입 전에 거절한다", async (song, code) => {
  lock.mockResolvedValue(song);
  await expect(createAdminCheerGuide(context, input)).rejects.toMatchObject({ code });
  expect(insert).not.toHaveBeenCalled();
});
it("동일 모드 중복과 snapshot 저장 실패를 성공으로 처리하지 않는다", async () => {
  insert.mockResolvedValueOnce(undefined);
  await expect(createAdminCheerGuide(context, input)).rejects.toMatchObject({
    code: "CHEER_GUIDE_ALREADY_EXISTS",
  });
  expect(snapshot).not.toHaveBeenCalled();
  const error = new Error("snapshot failure");
  snapshot.mockRejectedValueOnce(error);
  await expect(createAdminCheerGuide(context, input)).rejects.toBe(error);
});
