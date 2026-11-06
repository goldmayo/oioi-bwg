"use client";

import type { AnalyticsReport } from "@oioi-bwg/contracts/analytics";

import { type AnalyticsMetric, analyticsNumber, analyticsSeries } from "../_lib/analytics";

export function AnalyticsTrend({
  report,
  metric,
}: {
  report: AnalyticsReport;
  metric: AnalyticsMetric;
}) {
  const series = analyticsSeries(report, metric);
  if (report.rows.length === 0)
    return (
      <p className="text-muted-foreground py-8 text-sm">선택한 기간에 표시할 데이터가 없습니다.</p>
    );
  const indexes = [
    ...new Set([0, Math.floor((series.dates.length - 1) / 2), series.dates.length - 1]),
  ];
  return (
    <figure aria-label="날짜별 이용 추세" className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="relative h-40 sm:h-52">
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            {[0, 1, 2, 3].map((value) => (
              <div key={value} className="border-border/70 border-t" />
            ))}
          </div>
          <svg
            viewBox="0 -3 600 186"
            preserveAspectRatio="none"
            className="text-ring relative h-full w-full overflow-visible"
            aria-hidden="true"
          >
            <path
              d={series.path}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {series.points.filter((point) => point !== null).length === 1 &&
              series.points.map(
                (point) =>
                  point && (
                    <circle key={point.date} cx={point.x} cy={point.y} r="3" fill="currentColor" />
                  ),
              )}
          </svg>
        </div>
        <div
          className="text-muted-foreground flex flex-col justify-between text-right text-xs leading-none tabular-nums"
          aria-hidden="true"
        >
          {[1, 2 / 3, 1 / 3, 0].map((fraction) => (
            <span key={fraction}>
              {analyticsNumber.format(Math.round(series.ceiling * fraction))}
            </span>
          ))}
        </div>
      </div>
      <div
        className="text-muted-foreground flex justify-between pr-6 text-xs tabular-nums"
        aria-hidden="true"
      >
        {indexes.map((index) => (
          <span key={index}>{series.dates[index].slice(5).replace("-", ".")}</span>
        ))}
      </div>
      <details className="text-muted-foreground text-xs">
        <summary className="focus-visible:outline-ring cursor-pointer py-2 outline-offset-2 focus-visible:outline-2">
          일별 수치 보기
        </summary>
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr>
                <th scope="col">날짜</th>
                <th scope="col" className="text-right">
                  집계
                </th>
              </tr>
            </thead>
            <tbody>
              {series.points.map((point, index) => (
                <tr key={series.dates[index]}>
                  <td className="py-1">{series.dates[index]}</td>
                  <td className="text-right">
                    {point ? analyticsNumber.format(point.value) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
