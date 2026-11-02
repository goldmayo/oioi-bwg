import { z } from "zod";

import { entityIdSchema } from "./entity-id";
import { adminSongSummarySchema } from "./song";

export const cheerGuideModeSchema = z.enum(["CONCERT", "FESTIVAL"]);
export const cheerGuideSourceTypeSchema = z.enum(["OFFICIAL", "FANDOM"]);
const webUrl = z
  .string()
  .trim()
  .pipe(z.url({ protocol: /^https?$/ }));

/** 가사와 기준 영상은 선택한 Song에서 서버가 읽는다. 작성자·이력 ID도 입력받지 않는다. */
export const createAdminCheerGuideSchema = z
  .object({
    songId: entityIdSchema,
    mode: cheerGuideModeSchema,
    sourceType: cheerGuideSourceTypeSchema,
    sourceUrl: webUrl.nullable(),
    guideVideoUrl: webUrl.nullable(),
    description: z.string().trim().min(1).nullable(),
  })
  .strict()
  .refine((guide) => guide.sourceType !== "OFFICIAL" || guide.sourceUrl !== null, {
    path: ["sourceUrl"],
    message: "공식 응원법의 원본 링크가 필요합니다.",
  });
export type CreateAdminCheerGuide = z.infer<typeof createAdminCheerGuideSchema>;

/** 한 행은 Song + mode의 Guide다. 공개 조치는 실제 사용자 노출과 구분한다. */
export const adminCheerGuideIdParamsSchema = z.object({ id: entityIdSchema });
export const adminCheerGuideSummarySchema = z.object({
  id: entityIdSchema,
  mode: cheerGuideModeSchema,
  updatedAt: z.string(),
  song: adminSongSummarySchema.pick({ id: true, slug: true }).extend({
    title: z.string(),
    albumName: z.string(),
  }),
  currentPublication: z
    .object({
      action: z.enum(["PUBLISH", "UNPUBLISH"]),
      sourceType: cheerGuideSourceTypeSchema,
    })
    .nullable(),
  editorAvailable: z.boolean(),
  deletable: z.boolean().default(false),
});

export const adminCheerGuideListSchema = z.object({
  items: z.array(adminCheerGuideSummarySchema),
  nextCursor: z.null(),
});
export type AdminCheerGuideSummary = z.infer<typeof adminCheerGuideSummarySchema>;
export type AdminCheerGuideList = z.infer<typeof adminCheerGuideListSchema>;
