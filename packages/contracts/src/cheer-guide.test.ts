import { expect, it } from "vitest";

import { createAdminCheerGuideSchema } from "./cheer-guide";

const input = {
  songId: "019a0170-0000-7000-8000-000000000001",
  mode: "CONCERT",
  sourceType: "FANDOM",
  sourceUrl: null,
  guideVideoUrl: null,
  description: null,
};
it("공식은 원본 링크가 필요하며 팬덤은 링크·영상·설명을 생략할 수 있다", () => {
  expect(createAdminCheerGuideSchema.parse(input)).toEqual(input);
  expect(createAdminCheerGuideSchema.safeParse({ ...input, sourceType: "OFFICIAL" }).success).toBe(
    false,
  );
  expect(
    createAdminCheerGuideSchema.parse({
      ...input,
      sourceType: "OFFICIAL",
      sourceUrl: " https://example.invalid/source ",
    }).sourceUrl,
  ).toBe("https://example.invalid/source");
});
it.each([
  { songId: "not-uuid" },
  { mode: "FAN" },
  { sourceType: "USER" },
  { sourceUrl: "javascript:alert(1)" },
  { guideVideoUrl: "file:///secret" },
  { description: "   " },
  { createdByAccountId: input.songId },
  { referenceYoutubeId: "client-reference" },
  { lyrics: [] },
])("기존 모드·출처·URL 규칙을 지키고 서버가 소유한 입력을 거부한다: %j", (change) => {
  expect(createAdminCheerGuideSchema.safeParse({ ...input, ...change }).success).toBe(false);
});
