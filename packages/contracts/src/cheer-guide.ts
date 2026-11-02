import { z } from "zod";

import { entityIdSchema } from "./entity-id";
import { adminSongSummarySchema } from "./song";

/** 한 행은 Song + mode의 Guide다. 공개 조치는 실제 사용자 노출과 구분한다. */
export const adminCheerGuideSummarySchema = z.object({
  id: entityIdSchema,
  mode: z.enum(["CONCERT", "FESTIVAL"]),
  updatedAt: z.string(),
  song: adminSongSummarySchema.pick({ id: true, slug: true }).extend({
    title: z.string(),
    albumName: z.string(),
  }),
  currentPublication: z
    .object({
      action: z.enum(["PUBLISH", "UNPUBLISH"]),
      sourceType: z.enum(["OFFICIAL", "FANDOM"]),
    })
    .nullable(),
  editorAvailable: z.boolean(),
});

export const adminCheerGuideListSchema = z.object({
  items: z.array(adminCheerGuideSummarySchema),
  nextCursor: z.null(),
});
export type AdminCheerGuideSummary = z.infer<typeof adminCheerGuideSummarySchema>;
export type AdminCheerGuideList = z.infer<typeof adminCheerGuideListSchema>;
