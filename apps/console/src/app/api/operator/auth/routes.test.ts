import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  exchange: vi.fn(),
  approve: vi.fn(),
  authorize: vi.fn(),
  revoke: vi.fn(),
  auth: vi.fn(),
  report: vi.fn(),
}));
vi.mock("@oioi-bwg/server/services/operator-auth-service", () => ({
  createOperatorGrant: mocks.create,
  exchangeOperatorGrant: mocks.exchange,
  approveOperatorGrant: mocks.approve,
  authorizeOperatorToken: mocks.authorize,
  revokeOperatorToken: mocks.revoke,
}));
vi.mock("@/server/auth/request-context", () => ({ getRequestAuthorization: mocks.auth }));
vi.mock("@/server/observability/server-error-reporter", () => ({
  reportServerError: mocks.report,
}));
import { POST as approve } from "./approve/route";
import { POST as device } from "./device/route";
import { POST as revoke } from "./revoke/route";
import { GET as session } from "./session/route";
import { POST as token } from "./token/route";
const accountId = "019a0170-0000-7000-8000-000000000001";
const secret = "oioi_" + "a".repeat(64);
const deviceCode = "b".repeat(64);
const expiresAt = "2026-10-31T08:00:00Z";
const context = { user: { id: accountId }, ability: { cannot: () => false } };
function request(path: string, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Request(`http://127.0.0.1:3001/api/operator/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONSOLE_OPERATOR_ENABLED", "true");
  vi.stubEnv("CONSOLE_ORIGIN", "http://127.0.0.1:3001");
  Reflect.deleteProperty(globalThis, "__oioiOperatorLimits");
  mocks.create.mockResolvedValue({
    deviceCode,
    userCode: "ABCD-2345",
    intervalSeconds: 5,
    expiresAt,
  });
  mocks.exchange.mockResolvedValue({ status: "pending" });
  mocks.approve.mockResolvedValue({ approved: true });
  mocks.authorize.mockResolvedValue({ context, accountId, expiresAt });
  mocks.revoke.mockResolvedValue({ revoked: true });
  mocks.auth.mockResolvedValue({ context, mfaVersion: 2 });
});
afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(globalThis, "__oioiOperatorLimits");
});
it("모든 operator 진입점은 기본 비활성이며 인증·본문·service 전에 거절한다", async () => {
  vi.stubEnv("CONSOLE_OPERATOR_ENABLED", "false");
  for (const handler of [device, token, approve, session, revoke]) {
    const response = await handler(request("test"));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  for (const mock of [
    mocks.create,
    mocks.exchange,
    mocks.approve,
    mocks.authorize,
    mocks.revoke,
    mocks.auth,
  ])
    expect(mock).not.toHaveBeenCalled();
});
it("CLI 접수는 cookie·Origin·추가 실행 설정·초과 본문을 service 전에 거절한다", async () => {
  const browserHeaders: Record<string, string>[] = [
    { cookie: "session=anything" },
    { origin: "http://127.0.0.1:3001" },
  ];
  for (const headers of browserHeaders)
    expect((await device(request("device", {}, headers))).status).toBe(403);
  expect((await device(request("device", { command: "anything" }))).status).toBe(400);
  expect((await device(request("device", "x".repeat(1025)))).status).toBe(413);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("발급은 제한된 응답을 no-store로 전달하고 IP 접수 빈도를 제한한다", async () => {
  for (let i = 0; i < 5; i++) expect((await device(request("device"))).status).toBe(200);
  const limited = await device(request("device"));
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(await limited.json()).toMatchObject({ code: "OPERATOR_RATE_LIMITED" });
  expect(mocks.create).toHaveBeenCalledTimes(5);
});
it("token polling은 strict device body와 5초 간격을 적용한다", async () => {
  expect((await token(request("token", { deviceCode, accountId }))).status).toBe(400);
  const response = await token(request("token", { deviceCode }));
  expect(await response.json()).toEqual({ status: "pending" });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await token(request("token", { deviceCode }))).status).toBe(429);
  expect(mocks.exchange).toHaveBeenCalledOnce();
});
it("승인은 현재 브라우저 MFA 증명과 Origin을 요구하며 version을 client에서 받지 않는다", async () => {
  const headers = { origin: "http://127.0.0.1:3001" };
  mocks.auth.mockResolvedValueOnce({ context });
  expect((await approve(request("approve", { userCode: "ABCD-2345" }, headers))).status).toBe(401);
  expect(
    (await approve(request("approve", { userCode: "ABCD-2345" }, { origin: "https://other.test" })))
      .status,
  ).toBe(403);
  expect(
    (await approve(request("approve", { userCode: "ABCD-2345", mfaVersion: 1 }, headers))).status,
  ).toBe(400);
  expect(mocks.approve).not.toHaveBeenCalled();
  expect((await approve(request("approve", { userCode: " abcd-2345 " }, headers))).status).toBe(
    200,
  );
  expect(mocks.approve).toHaveBeenCalledWith(context, 2, "ABCD-2345");
});
it("연결 조회는 bearer만 사용하고 내부 권한 객체는 응답하지 않는다", async () => {
  const url = "http://127.0.0.1:3001/api/operator/auth/session";
  expect(
    (
      await session(
        new Request(url, { headers: { authorization: `Bearer ${secret}`, cookie: "session=x" } }),
      )
    ).status,
  ).toBe(403);
  expect((await session(new Request(url))).status).toBe(401);
  const response = await session(
    new Request(url, { headers: { authorization: `Bearer ${secret}` } }),
  );
  expect(await response.json()).toEqual({ accountId, expiresAt });
  expect(mocks.authorize).toHaveBeenCalledWith(secret);
});
it("로그아웃은 bearer 인가 후 제한된 본문만 읽고 해당 연결을 회수한다", async () => {
  const headers = { authorization: `Bearer ${secret}` };
  expect((await revoke(request("revoke", { accountId }, headers))).status).toBe(400);
  expect(mocks.revoke).not.toHaveBeenCalled();
  expect((await revoke(request("revoke", {}, headers))).status).toBe(200);
  expect(mocks.revoke).toHaveBeenCalledWith(secret);
});
it("발급 결과가 깨져도 비밀 원문을 오류 응답에 노출하지 않는다", async () => {
  mocks.create.mockResolvedValue({
    deviceCode: "private-device-secret",
    accessToken: "private-access-secret",
  });
  const response = await device(request("device"));
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private-");
  expect(mocks.report).toHaveBeenCalledOnce();
});
