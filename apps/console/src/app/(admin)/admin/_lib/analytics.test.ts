import { analyticsRangeSchema, type AnalyticsReport } from "@oioi-bwg/contracts/analytics";
import { expect, it } from "vitest";

import { analyticsDateAgo, analyticsSeries, analyticsShare } from "./analytics";

it("서울 자정 경계와 윤년을 포함하는 실제 날짜·최대 기간을 검증한다", () => {
  expect(analyticsDateAgo(1, Date.parse("2026-11-06T15:00:00Z"))).toBe("2026-11-06");
  expect(analyticsRangeSchema.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success).toBe(
    false,
  );
  expect(analyticsRangeSchema.safeParse({ from: "2026-11-06", to: "2026-11-05" }).success).toBe(
    false,
  );
  expect(analyticsRangeSchema.safeParse({ from: "2024-01-01", to: "2024-12-31" }).success).toBe(
    true,
  );
  expect(analyticsRangeSchema.safeParse({ from: "2024-01-01", to: "2025-01-01" }).success).toBe(
    false,
  );
});
it("전체 사용자가 0이면 비율을 구분하고 같은 사용자의 중복 기기를 보존한다", () => {
  expect(analyticsShare(0, 0)).toBeNull();
  expect(analyticsShare(0, 29)).toBe(0);
  expect(analyticsShare(20, 29)).toBeCloseTo(0.689655);
  expect(analyticsShare(20, 29)! + analyticsShare(9, 29)! + analyticsShare(1, 29)!).toBeGreaterThan(
    1,
  );
});
it("차트 데이터에서 누락 날짜와 실제 0을 구분한다", () => {
  const report = {
    from: "2026-11-01",
    to: "2026-11-03",
    rows: [
      { label: "20261101", users: 0 },
      { label: "20261103", users: 8 },
    ],
  } as AnalyticsReport;
  expect(analyticsSeries(report, "users")).toEqual([
    { date: "2026-11-01", value: 0 },
    { date: "2026-11-02", value: null },
    { date: "2026-11-03", value: 8 },
  ]);
});
