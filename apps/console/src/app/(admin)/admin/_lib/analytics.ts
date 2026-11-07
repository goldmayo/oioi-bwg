import type { AnalyticsRange, AnalyticsReport } from "@oioi-bwg/contracts/analytics";

const calendar = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeZone: "Asia/Seoul" });
export const analyticsNumber = new Intl.NumberFormat("ko-KR");
export const analyticsPercent = new Intl.NumberFormat("ko-KR", {
  style: "percent",
  maximumFractionDigits: 1,
});
export const analyticsTime = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});
export const analyticsMetrics = [
  { key: "users", title: "활성 사용자" },
  { key: "sessions", title: "세션" },
  { key: "views", title: "페이지 조회수" },
] as const;
export type AnalyticsMetric = (typeof analyticsMetrics)[number]["key"];

export function analyticsDateAgo(days: number, now = Date.now()) {
  return calendar.format(new Date(now - days * 86_400_000));
}

export function analyticsPreset(days: number): AnalyticsRange {
  return { from: analyticsDateAgo(days + 1), to: analyticsDateAgo(2) };
}

export function analyticsShare(users: number, total: number) {
  return total > 0 ? users / total : null;
}

/** Google에서 생략된 날짜는 누락으로 남겨 선을 끊는다. */
export function analyticsSeries(report: AnalyticsReport, metric: AnalyticsMetric) {
  const start = Date.parse(report.from);
  const count = Math.round((Date.parse(report.to) - start) / 86_400_000) + 1;
  const values = new Map(report.rows.map((row) => [row.label, row[metric]]));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    return { date, value: values.get(date.replaceAll("-", "")) ?? null };
  });
}
