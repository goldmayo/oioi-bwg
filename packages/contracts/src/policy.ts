import { z } from "zod";
import { entityIdSchema } from "./entity-id";

export const policySlugSchema = z.enum(["privacy", "terms", "copyright", "email", "ga"]);
const text = z.string().trim().min(1);
export const publicPolicySummarySchema = z.object({
  id: entityIdSchema,
  slug: policySlugSchema,
  version: z.number().int().positive(),
  title: text.max(200),
  description: text.max(500),
  effectiveOn: z.iso.date(),
});
export const publicPolicySchema = publicPolicySummarySchema.extend({
  content: z.array(text.max(10000)).min(1).max(100),
  changeNotice: text.max(2000).nullable(),
});
export type PublicPolicy = z.infer<typeof publicPolicySchema>;
