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
  const count = Math.round((Date.parse(report.to) - Date.parse(report.from)) / 86_400_000) + 1;
  const values = new Map(report.rows.map((row) => [row.label, row[metric]]));
  const dates = Array.from({ length: count }, (_, index) =>
    new Date(Date.parse(report.from) + index * 86_400_000).toISOString().slice(0, 10),
  );
  const maximum = Math.max(1, ...values.values());
  const scale = 10 ** Math.floor(Math.log10(maximum));
  const ceiling = Math.max(3, Math.ceil(maximum / (3 * scale)) * 3 * scale);
  const points = dates.map((date, index) => {
    const value = values.get(date.replaceAll("-", ""));
    return value === undefined
      ? null
      : {
          x: count === 1 ? 300 : (index / (count - 1)) * 600,
          y: 180 - (value / ceiling) * 180,
          date,
          value,
        };
  });
  let connected = false;
  const path = points
    .map((point) => {
      if (!point) {
        connected = false;
        return "";
      }
      const command = connected ? "L" : "M";
      connected = true;
      return `${command}${point.x},${point.y}`;
    })
    .join(" ");
  return { points, path, ceiling, dates };
}
