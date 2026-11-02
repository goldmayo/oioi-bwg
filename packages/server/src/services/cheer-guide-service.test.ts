import { adminCheerGuideListSchema } from "@oioi-bwg/contracts/cheer-guide";
import { beforeEach, expect, it, vi } from "vitest";

import { AppError } from "../errors/app-error";

const find = vi.hoisted(() => vi.fn());
const database = vi.hoisted(() => vi.fn(() => ({})));
vi.mock("../db", () => ({ getDatabase: database }));
vi.mock("../repositories/cheer-guide-repository", () => ({ findAdminCheerGuides: find }));

import { listAdminCheerGuides } from "./cheer-guide-service";

const id = "019a0170-0000-7000-8000-000000000001";
const ctx = { user: { id }, ability: { cannot: () => false } } as never;
const row = {
  id,
  mode: "CONCERT",
  updatedAt: "2026-11-02",
  legacyWriteTarget: true,
  song: { id, title: null, slug: "song", youtubeId: "video", album: { name: "앨범" } },
  currentPublication: {
    action: "PUBLISH",
    snapshot: { sourceType: "FANDOM", referenceYoutubeId: "video" },
  },
};
beforeEach(() => vi.clearAllMocks());

it("Guide별 행과 snapshot 출처를 반환하고 private row와 이력을 노출하지 않는다", async () => {
  find.mockResolvedValue([
    { ...row, createdByAccountId: id, lyrics: ["private"] },
    {
      ...row,
      id: "019a0170-0000-7000-8000-000000000002",
      mode: "FESTIVAL",
      legacyWriteTarget: false,
      currentPublication: null,
    },
  ]);
  const result = await listAdminCheerGuides(ctx);
  expect(result).toEqual({
    items: [
      {
        id,
        mode: "CONCERT",
        updatedAt: row.updatedAt,
        song: { id, title: "", slug: "song", albumName: "앨범" },
        currentPublication: { action: "PUBLISH", sourceType: "FANDOM" },
        editorAvailable: true,
      },
      {
        id: "019a0170-0000-7000-8000-000000000002",
        mode: "FESTIVAL",
        updatedAt: row.updatedAt,
        song: { id, title: "", slug: "song", albumName: "앨범" },
        currentPublication: null,
        editorAvailable: false,
      },
    ],
    nextCursor: null,
  });
  expect(adminCheerGuideListSchema.parse(result)).toEqual(result);
});

it.each([
  { legacyWriteTarget: false },
  { song: { ...row.song, slug: null } },
  { currentPublication: null },
  { currentPublication: { ...row.currentPublication, action: "UNPUBLISH" } },
  { song: { ...row.song, youtubeId: "different" } },
])(
  "기존 writer 대상·공개·기준 영상 조건이 다르면 편집 가능으로 표시하지 않는다: %j",
  async (change) => {
    find.mockResolvedValue([{ ...row, ...change }]);
    expect((await listAdminCheerGuides(ctx)).items[0]?.editorAvailable).toBe(false);
  },
);

it("인증·인가 실패 시 DB를 획득하거나 조회하지 않는다", async () => {
  await expect(listAdminCheerGuides({ user: null } as never)).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  await expect(
    listAdminCheerGuides({ user: { id }, ability: { cannot: () => true } } as never),
  ).rejects.toEqual(new AppError("FORBIDDEN"));
  expect(database).not.toHaveBeenCalled();
  expect(find).not.toHaveBeenCalled();
});
