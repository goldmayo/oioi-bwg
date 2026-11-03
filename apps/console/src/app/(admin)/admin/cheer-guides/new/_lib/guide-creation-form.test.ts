import { describe, expect, it } from "vitest";

import { guideCreationFormSchema } from "./guide-creation-form";

const input = {
  songId: "019a0170-0000-7000-8000-000000000002",
  mode: "CONCERT",
  sourceType: "FANDOM",
  sourceUrl: "  ",
  description: " 참고 사항 ",
};

describe("응원법 추가 폼의 HTTP 입력 변환", () => {
  it("공백을 정리하고 선택 항목을 null로 전달하며 별도 안내 영상을 받지 않는다", () => {
    expect(guideCreationFormSchema.parse(input)).toEqual({
      ...input,
      sourceUrl: null,
      description: "참고 사항",
      guideVideoUrl: null,
    });
  });
  it("공식 출처의 빈 원본 링크를 해당 입력에서 안내한다", () => {
    const result = guideCreationFormSchema.safeParse({ ...input, sourceType: "OFFICIAL" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["sourceUrl"]);
  });
  it("곡 미선택과 실행 가능한 URL을 거절한다", () => {
    expect(guideCreationFormSchema.safeParse({ ...input, songId: "" }).success).toBe(false);
    expect(
      guideCreationFormSchema.safeParse({ ...input, sourceUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
});
