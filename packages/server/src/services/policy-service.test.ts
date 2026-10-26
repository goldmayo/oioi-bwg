import { beforeEach, expect, it, vi } from "vitest";
const repository = vi.hoisted(() => ({ findLatestPublishedPolicies: vi.fn() }));
vi.mock("../db", () => ({ getDatabase: () => ({}) }));
vi.mock("../repositories/policy-repository", () => repository);
import { getPublicPolicy, listPublicPolicies } from "./policy-service";
const policy = {
  id: "01a177c2-7216-75a8-824b-093241e80cd9",
  slug: "privacy",
  version: 1,
  title: "개인정보 처리방침",
  description: "처리 안내",
  effectiveOn: "2026-04-06",
  content: ["본문"],
  changeNotice: null,
};
beforeEach(() => vi.clearAllMocks());
it.each(["toString", "constructor", "__proto__", "missing", "Privacy"])(
  "미등록 경로 %s는 DB 조회 없이 찾을 수 없음으로 처리한다",
  async (slug) => {
    expect(await getPublicPolicy(slug)).toBeNull();
    expect(repository.findLatestPublishedPolicies).not.toHaveBeenCalled();
  },
);
it("목록은 기존 순서와 요약 필드만 노출하고 상세는 내부 상태·시각을 제거한다", async () => {
  repository.findLatestPublishedPolicies.mockResolvedValue([
    { ...policy, slug: "ga" },
    { ...policy, isPublished: true, createdAt: "internal" },
  ]);
  const items = await listPublicPolicies();
  expect(items.map(({ slug }) => slug)).toEqual(["privacy", "ga"]);
  expect(items[0]).not.toHaveProperty("content");
  expect(items[0]).not.toHaveProperty("isPublished");
  repository.findLatestPublishedPolicies.mockResolvedValue([{ ...policy, createdAt: "internal" }]);
  expect(await getPublicPolicy("privacy")).toEqual(policy);
});
it("공개본 없음과 저장 오류·DB 장애를 구별한다", async () => {
  repository.findLatestPublishedPolicies.mockResolvedValue([]);
  expect(await getPublicPolicy("privacy")).toBeNull();
  expect(await listPublicPolicies()).toEqual([]);
  repository.findLatestPublishedPolicies.mockResolvedValue([{ ...policy, content: [" "] }]);
  await expect(getPublicPolicy("privacy")).rejects.toThrow("Stored policy contract violation");
  repository.findLatestPublishedPolicies.mockResolvedValue([{ ...policy, title: " " }]);
  await expect(listPublicPolicies()).rejects.toThrow("Stored policy contract violation");
  const error = new Error("database unavailable");
  repository.findLatestPublishedPolicies.mockRejectedValue(error);
  await expect(getPublicPolicy("privacy")).rejects.toBe(error);
});
