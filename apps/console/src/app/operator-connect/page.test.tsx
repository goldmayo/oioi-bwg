import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(path);
  }),
}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/server/auth/request-context", () => ({ getRequestAuthorization: mocks.auth }));
vi.mock("./_ui/operator-connect-form", () => ({ OperatorConnectForm: () => null }));
import Page from "./page";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("비활성 상태에서는 DB 인증보다 먼저 404로 닫는다", async () => {
  vi.stubEnv("CONSOLE_OPERATOR_ENABLED", "false");
  await expect(Page()).rejects.toThrow("not-found");
  expect(mocks.auth).not.toHaveBeenCalled();
});
it("현재 MFA 로그인 없는 요청은 고정된 로그인 복귀값으로 보낸다", async () => {
  vi.stubEnv("CONSOLE_OPERATOR_ENABLED", "true");
  mocks.auth.mockResolvedValue({ context: { user: null } });
  await expect(Page()).rejects.toThrow("/admin-login?next=operator");
  mocks.auth.mockResolvedValue({ context: { user: { id: "fixture" } }, mfaVersion: 1 });
  expect((await Page()).type).toBe("main");
});
