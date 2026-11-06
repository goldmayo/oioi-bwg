import { z } from "zod";

export const analyticsReportIdSchema = z.enum([
  "summary",
  "trend",
  "pages",
  "channels",
  "sources",
  "devices",
  "browsers",
]);
export const analyticsRangeSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine(({ from, to }) => from <= to, { message: "조회 기간을 확인하세요." })
  .refine(({ from, to }) => Date.parse(to) - Date.parse(from) < 366 * 86_400_000, {
    message: "조회 기간은 최대 366일입니다.",
  });
export const analyticsInputSchema = analyticsRangeSchema.and(
  z.object({ report: analyticsReportIdSchema }),
);
const metricsSchema = z.object({
  users: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  views: z.number().int().nonnegative(),
});
export const analyticsReportSchema = z.object({
  report: analyticsReportIdSchema,
  from: z.iso.date(),
  to: z.iso.date(),
  fetchedAt: z.iso.datetime(),
  timeZone: z.string(),
  totals: metricsSchema,
  rows: z.array(metricsSchema.extend({ label: z.string() })),
  thresholded: z.boolean(),
  sampled: z.boolean(),
  truncated: z.boolean(),
});
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;
export type AnalyticsInput = z.infer<typeof analyticsInputSchema>;
export type AnalyticsReportId = z.infer<typeof analyticsReportIdSchema>;
export type AnalyticsReport = z.infer<typeof analyticsReportSchema>;
