import { z } from "zod";
import { entityIdSchema } from "./entity-id";

const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
// 큰 작업 파일은 CLI가 500개씩 나누어 조회한다. 내보내기 파일의 곡 수를 제한하지 않는다.
export const operatorSongResolveInputSchema = z.strictObject({
  videoIds: z
    .array(videoId)
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length),
});
export const operatorSongMatchSchema = z.discriminatedUnion("status", [
  z.strictObject({
    videoId,
    status: z.literal("matched"),
    songId: entityIdSchema,
    title: z.string(),
    editorHref: z.string().startsWith("/admin/edit/").nullable(),
  }),
  z.strictObject({ videoId, status: z.literal("missing") }),
  z.strictObject({ videoId, status: z.literal("ambiguous"), matchCount: z.number().int().min(2) }),
]);
export const operatorSongResolveResultSchema = z.strictObject({
  items: z.array(operatorSongMatchSchema).min(1).max(500),
});
export type OperatorSongMatch = z.infer<typeof operatorSongMatchSchema>;
