import { z } from "zod";
import { entityIdSchema } from "./entity-id";

const text = z.string().trim().min(1);
const common = { id: entityIdSchema, title: text.max(200), publishedOn: z.iso.date() };
export const publicNoticeSchema = z.object({
  ...common,
  kind: z.literal("notice"),
  category: text.max(40),
  content: text.max(20000),
});
export const publicUpdateSchema = z.object({
  ...common,
  kind: z.literal("update"),
  releaseVersion: text.max(40),
  content: z.array(text.max(2000)).min(1).max(100),
});
export type PublicNotice = z.infer<typeof publicNoticeSchema>;
export type PublicUpdate = z.infer<typeof publicUpdateSchema>;
