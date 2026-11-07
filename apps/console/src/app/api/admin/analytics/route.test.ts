// @vitest-environment node
import { buildAbility } from "@oioi-bwg/server/auth/ability";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { beforeEach, expect, it, vi } from "vitest";

import { getAnalyticsReport } from "@/server/analytics/ga4";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { GET } from "./route";

vi.mock("@/server/analytics/ga4", () => ({ getAnalyticsReport: vi.fn() }));
vi.mock("@/server/auth/request-context", async () => ({
  ...(await import("@oioi-bwg/server/auth/request-context")),
  getRequestAuthorization: vi.fn(),
}));
vi.mock("@/server/observability/server-error-reporter", () => ({ reportServerError: vi.fn() }));
vi.mock("@/server/observability/auth-rejection-logger", () => ({ logAuthRejection: vi.fn() }));
const id = "019a0170-0000-7000-8000-000000000001";
const input = "report=devices&from=2026-10-09&to=2026-11-05";
const request = (query = input) =>
  new Request(`http://127.0.0.1:3001/api/admin/analytics?${query}`);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getRequestAuthorization).mockResolvedValue({
    context: { user: { id }, ability: buildAbility({ accountId: id, role: "ADMIN" }) },
    decision: "authorized",
    rejectionLogged: false,
  });
});
it("미인증 요청은 기간 검증과 외부 조회 전에 거부한다", async () => {
  vi.mocked(getRequestAuthorization).mockResolvedValue({
    context: { user: null, ability: buildAbility({ accountId: null, role: null }) },
    decision: "no_valid_identity",
    rejectionLogged: false,
  });
  expect((await GET(request("report=invalid"))).status).toBe(401);
  expect(getAnalyticsReport).not.toHaveBeenCalled();
});
it.each([
  "report=invalid&from=2026-10-01&to=2026-10-07",
  "report=devices&from=2026-11-05&to=2026-11-01",
  "report=devices&from=2026-10-01&to=9999-01-01",
])("기간과 보고서 식별자를 boundary에서 검증한다", async (query) => {
  expect((await GET(request(query))).status).toBe(400);
  expect(getAnalyticsReport).not.toHaveBeenCalled();
});
it("실패한 보고서의 안전한 오류만 반환한다", async () => {
  vi.mocked(getAnalyticsReport).mockRejectedValue(
    new AppError("ANALYTICS_UNAVAILABLE", { token: "SECRET_MARKER" }),
  );
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("SECRET_MARKER");
});
it("출력 계약 위반은 입력 오류와 구분해 500으로 처리한다", async () => {
  vi.mocked(getAnalyticsReport).mockResolvedValue(
    {} as Awaited<ReturnType<typeof getAnalyticsReport>>,
  );
  expect((await GET(request())).status).toBe(500);
});
