import { beforeEach, expect, it, vi } from "vitest";

import { buildAbility } from "../auth/ability";
import type { RequestContext } from "../auth/request-context";

const repository = vi.hoisted(() => ({
  findHomeCarousel: vi.fn(),
  findPublishedHomeCarousel: vi.fn(),
  saveHomeCarouselDraft: vi.fn(),
}));
const database = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ getDatabase: database }));
vi.mock("../repositories/home-carousel-repository", () => repository);
import {
  getAdminHomeCarousel,
  getPublicHomeCarousel,
  saveAdminHomeCarouselDraft,
} from "./home-carousel-service";

beforeEach(() => vi.resetAllMocks());

it.each([
  [null, "UNAUTHENTICATED"],
  ["USER", "FORBIDDEN"],
  ["REVIEWER", "FORBIDDEN"],
] as const)("CAROUSEL-001 %s의 관리 조회·저장은 DB 접근 전에 거절한다", async (role, code) => {
  const accountId = role ? "019a0170-0000-7000-8000-000000000001" : null;
  const context = {
    user: accountId ? { id: accountId } : null,
    ability: buildAbility({ accountId, role }),
  } as RequestContext;
  await expect(getAdminHomeCarousel(context)).rejects.toMatchObject({ code });
  await expect(
    saveAdminHomeCarouselDraft(context, { expectedLockVersion: 0, items: [] }),
  ).rejects.toMatchObject({ code });
  expect(database).not.toHaveBeenCalled();
});

it("CAROUSEL-002 공개 조회는 빈 구성과 저장 계약 위반·DB 장애를 구분한다", async () => {
  repository.findPublishedHomeCarousel.mockResolvedValue(undefined);
  await expect(getPublicHomeCarousel()).resolves.toEqual({ items: [] });
  repository.findPublishedHomeCarousel.mockResolvedValue({ items: [{ name: "비공개 관리 이름" }] });
  await expect(getPublicHomeCarousel()).rejects.toThrow(
    "Stored public home carousel contract violation",
  );
  const error = new Error("database unavailable");
  repository.findPublishedHomeCarousel.mockRejectedValue(error);
  await expect(getPublicHomeCarousel()).rejects.toBe(error);
});
