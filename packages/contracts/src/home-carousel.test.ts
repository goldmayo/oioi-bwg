import { describe, expect, it } from "vitest";

import {
  adminHomeCarouselSchema,
  homeCarouselSlideSchema,
  homeCarouselVersionInputSchema,
  publicHomeCarouselSchema,
  saveHomeCarouselDraftSchema,
} from "./home-carousel";

const slide = {
  id: "019a0170-0000-7000-8000-000000000001",
  image: {
    url: "https://assets.example.com/images/home-carousel/banner.webp",
    width: 1600,
    height: 600,
  },
  alt: "새로운 응원법 안내",
  href: "/chants?mode=CONCERT",
};
const draft = { ...slide, name: "홈 안내", isEnabled: false };
const save = { expectedLockVersion: 0, items: [draft] };

describe("CAROUSEL-001 콘텐츠 경계", () => {
  it.each([null, "/", "/songs/example#guide", "https://example.com/news?a=1#detail"])(
    "내부 경로·HTTPS 링크 또는 링크 없는 이미지를 허용한다: %s",
    (href) => expect(homeCarouselSlideSchema.parse({ ...slide, href }).href).toBe(href),
  );

  it.each([
    "//evil.example/path",
    "/\\evil.example",
    "/%5cevil.example",
    "/%2fevil.example",
    "/\nevil.example",
    "/path\u007f",
    "https://good.example\\@evil.example",
    "https://admin:password@example.com",
    "http://example.com",
    "https:example.com",
    "javascript:alert(1)",
    "data:text/html,test",
  ])("사용자정보·외부 origin 우회·실행 링크를 거절한다: %s", (href) => {
    expect(homeCarouselSlideSchema.safeParse({ ...slide, href }).success).toBe(false);
  });

  it("이미지 URL의 query·fragment, 빈 대체 텍스트와 잘못된 치수를 거절한다", () => {
    for (const image of [
      { ...slide.image, url: `${slide.image.url}?token=secret` },
      { ...slide.image, url: `${slide.image.url}#` },
      { ...slide.image, width: 0 },
      { ...slide.image, height: 16385 },
    ]) {
      expect(homeCarouselSlideSchema.safeParse({ ...slide, image }).success).toBe(false);
    }
    expect(homeCarouselSlideSchema.safeParse({ ...slide, alt: "  " }).success).toBe(false);
  });

  it("새 항목의 서버 ID 발급을 허용하고 기존 ID 중복과 10개 초과를 거절한다", () => {
    const fresh = {
      image: slide.image,
      alt: slide.alt,
      href: null,
      name: "신규",
      isEnabled: false,
    };
    expect(
      saveHomeCarouselDraftSchema.parse({ ...save, items: [fresh, fresh] }).items,
    ).toHaveLength(2);
    expect(saveHomeCarouselDraftSchema.safeParse({ ...save, items: [draft, draft] }).success).toBe(
      false,
    );
    expect(
      saveHomeCarouselDraftSchema.safeParse({ ...save, items: Array(11).fill(fresh) }).success,
    ).toBe(false);
  });
});

describe("CAROUSEL-002 초안·공개 계약", () => {
  it("초기 조회는 버전 0이지만 공개·숨김은 실제 저장 버전이 필요하다", () => {
    expect(
      adminHomeCarouselSchema.parse({
        id: null,
        lockVersion: 0,
        draftSlides: [],
        publishedSlides: [],
        updatedAt: null,
        publishedAt: null,
      }).lockVersion,
    ).toBe(0);
    expect(saveHomeCarouselDraftSchema.parse(save).expectedLockVersion).toBe(0);
    expect(homeCarouselVersionInputSchema.safeParse({ expectedLockVersion: 0 }).success).toBe(
      false,
    );
  });

  it("공개 요청으로 내용을 주입하거나 공개 DTO에 관리 필드를 섞는 것을 거절한다", () => {
    expect(
      homeCarouselVersionInputSchema.safeParse({ expectedLockVersion: 1, items: [slide] }).success,
    ).toBe(false);
    expect(publicHomeCarouselSchema.parse({ items: [slide] }).items).toEqual([slide]);
    expect(publicHomeCarouselSchema.safeParse({ items: [draft] }).success).toBe(false);
    expect(publicHomeCarouselSchema.safeParse({ items: [], draftSlides: [draft] }).success).toBe(
      false,
    );
  });
});
