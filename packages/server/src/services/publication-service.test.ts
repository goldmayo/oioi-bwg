import { beforeEach, expect, it, vi } from "vitest";
const repository = vi.hoisted(() => ({ findPublicPublications: vi.fn() }));
vi.mock("../db", () => ({ getDatabase: () => ({}) }));
vi.mock("../repositories/publication-repository", () => repository);
import { listPublicNotices, listPublicUpdates } from "./publication-service";
const notice = {
  id: "01a177c2-7216-75a8-824b-093241e80cd9",
  kind: "notice",
  title: "공지",
  publishedOn: "2026-04-06",
  category: "공지",
  content: "본문",
};
beforeEach(() => vi.clearAllMocks());
it("공개 내용만 DTO로 보내고 내부 공개 상태·잠금·시각을 제거한다", async () => {
  repository.findPublicPublications.mockResolvedValue([
    { ...notice, isPublished: true, lockVersion: 3, createdAt: "private", releaseVersion: null },
  ]);
  expect(await listPublicNotices()).toEqual([notice]);
  expect(repository.findPublicPublications).toHaveBeenCalledWith({}, "notice");
  repository.findPublicPublications.mockResolvedValue([]);
  expect(await listPublicUpdates()).toEqual([]);
  expect(repository.findPublicPublications).toHaveBeenLastCalledWith({}, "update");
});
it("저장 계약 위반과 DB 장애를 정적 내용으로 대체하지 않는다", async () => {
  repository.findPublicPublications.mockResolvedValue([{ ...notice, content: [] }]);
  await expect(listPublicNotices()).rejects.toThrow("Stored notice contract violation");
  repository.findPublicPublications.mockResolvedValue([
    { ...notice, kind: "update", releaseVersion: "v1", content: [" "] },
  ]);
  await expect(listPublicUpdates()).rejects.toThrow("Stored update contract violation");
  const error = new Error("database unavailable");
  repository.findPublicPublications.mockRejectedValue(error);
  await expect(listPublicNotices()).rejects.toBe(error);
});
