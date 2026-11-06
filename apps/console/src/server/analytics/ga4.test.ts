// @vitest-environment node
import { buildAbility } from "@oioi-bwg/server/auth/ability";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getAnalyticsReport } from "./ga4";

const { token, fetchMock } = vi.hoisted(() => ({ token: vi.fn(), fetchMock: vi.fn() }));
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    getAccessToken = token;
  },
}));
const id = "019a0170-0000-7000-8000-000000000001";
const admin = { user: { id }, ability: buildAbility({ accountId: id, role: "ADMIN" }) };
const input = { report: "devices" as const, from: "2026-10-09", to: "2026-11-05" };
const row = (label: string, users: number) => ({
  dimensionValues: [{ value: label }],
  metricValues: [users, 75, 163].map((value) => ({ value: String(value) })),
});
const report = (rows: ReturnType<typeof row>[]) => ({
  rows,
  rowCount: rows.length,
  metadata: { timeZone: "Asia/Seoul" },
});

beforeEach(() => {
  vi.stubEnv("GA4_PROPERTY_ID", "528128089");
  vi.stubEnv("GA4_SERVICE_ACCOUNT_FILE", "/local-key.json");
  vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", "");
  vi.stubGlobal("fetch", fetchMock);
  token.mockReset().mockResolvedValue("ACCESS_TOKEN_MARKER");
  fetchMock.mockReset().mockImplementation(async (_url, init) => {
    const body = JSON.parse(init.body);
    return Response.json({
      reports: body.requests.map((request: { dimensions: unknown[] }) =>
        report(
          request.dimensions.length
            ? [row("mobile", 20), row("desktop", 9), row("tablet", 1)]
            : [row("", 29)],
        ),
      ),
    });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("인증과 관리자 인가를 Google 인증보다 먼저 검사한다", async () => {
  await expect(
    getAnalyticsReport(
      { user: null, ability: buildAbility({ accountId: null, role: null }) },
      input,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  await expect(
    getAnalyticsReport(
      { user: { id }, ability: buildAbility({ accountId: id, role: "USER" }) },
      input,
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(token).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
it("비율 분모는 중복 기기의 합계 대신 별도 기간 전체 사용자를 반환한다", async () => {
  const result = await getAnalyticsReport(admin, input, new AbortController().signal);
  expect(result.totals.users).toBe(29);
  expect(result.rows.reduce((sum, item) => sum + item.users, 0)).toBe(30);
  expect(result.rows[0]).toEqual({ label: "mobile", users: 20, sessions: 75, views: 163 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const request = JSON.parse(fetchMock.mock.calls[0][1].body).requests[0];
  expect(request.dateRanges).toEqual([{ startDate: input.from, endDate: input.to }]);
});
it("빈 집계는 실제 0으로 반환한다", async () => {
  fetchMock.mockResolvedValue(Response.json({ reports: [report([])] }));
  const result = await getAnalyticsReport(
    admin,
    { ...input, report: "summary" },
    new AbortController().signal,
  );
  expect(result.totals).toEqual({ users: 0, sessions: 0, views: 0 });
  expect(result.rows).toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("파일과 JSON이 동시에 설정되면 외부 요청을 시작하지 않는다", async () => {
  vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", "{}");
  await expect(
    getAnalyticsReport(admin, input, new AbortController().signal),
  ).rejects.toMatchObject({ code: "ANALYTICS_NOT_CONFIGURED" });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("인증 예외에 포함된 키와 Google request config를 전달하지 않는다", async () => {
  token.mockRejectedValue(new Error("PRIVATE_KEY_MARKER ACCESS_TOKEN_MARKER"));
  const error: unknown = await getAnalyticsReport(admin, input, new AbortController().signal).catch(
    (reason: unknown) => reason,
  );
  expect(error).toMatchObject({ code: "ANALYTICS_UNAVAILABLE" });
  expect(JSON.stringify(error)).not.toContain("PRIVATE_KEY_MARKER");
  expect(String(error)).not.toContain("ACCESS_TOKEN_MARKER");
});
it("Google 할당량 오류를 원문 없이 정규화한다", async () => {
  fetchMock.mockImplementation(async () =>
    Response.json({ error: { message: "UPSTREAM_INTERNAL_MARKER" } }, { status: 429 }),
  );
  await expect(
    getAnalyticsReport(admin, input, new AbortController().signal),
  ).rejects.toMatchObject({ code: "ANALYTICS_RATE_LIMITED" });
});
it("깨진 외부 숫자는 0으로 숨기지 않고 안전한 오류로 처리한다", async () => {
  fetchMock.mockImplementation(async () =>
    Response.json({ ...report([row("mobile", 20)]), rows: [{ metricValues: [{ value: "NaN" }] }] }),
  );
  await expect(getAnalyticsReport(admin, input, new AbortController().signal)).rejects.toThrow(
    "Invalid GA4 reporting response",
  );
});
