import {
  cheerGuideModeSchema,
  cheerGuideSourceTypeSchema,
  createAdminCheerGuideSchema,
} from "@oioi-bwg/contracts/cheer-guide";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((text) => text || null);

/** 문자열 폼 초안을 HTTP 계약으로 변환한다. 가사·영상·작성자는 폼에서 만들지 않는다. */
export const guideCreationFormSchema = z
  .object({
    songId: z.string().min(1, "곡을 선택해주세요."),
    mode: cheerGuideModeSchema,
    sourceType: cheerGuideSourceTypeSchema,
    sourceUrl: optionalText,
    description: optionalText,
  })
  .transform((values): z.input<typeof createAdminCheerGuideSchema> => ({
    ...values,
    guideVideoUrl: null,
  }))
  .pipe(createAdminCheerGuideSchema);

export type GuideCreationInput = z.input<typeof guideCreationFormSchema>;
export type GuideCreationValues = z.output<typeof guideCreationFormSchema>;
