import "server-only";

import { z } from "zod";

const configSchema = z
  .object({
    propertyId: z.string().regex(/^\d+$/),
    json: z.string().optional(),
    file: z.string().optional(),
  })
  .refine(({ json, file }) => Boolean(json) !== Boolean(file));

export function getAnalyticsConfig() {
  return configSchema.safeParse({
    propertyId: process.env.GA4_PROPERTY_ID?.trim(),
    json: process.env.GA4_SERVICE_ACCOUNT_JSON?.trim() || undefined,
    file: process.env.GA4_SERVICE_ACCOUNT_FILE?.trim() || undefined,
  }).data;
}
