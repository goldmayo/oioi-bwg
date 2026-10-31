import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(path);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/auth/request-context", () => ({ getRequestContext: mocks.context }));
vi.mock("@/features/auth", () => ({ LazyLoginForm: () => null }));
import Page from "./page";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it.each(["https://evil.test", "//evil.test", "/operator-connect", ["operator"], undefined])(
  "임의 next=%s는 로그인 후 관리 화면으로 제한한다",
  async (next) => {
    vi.stubEnv("CONSOLE_OPERATOR_ENABLED", "true");
    mocks.context.mockResolvedValue({ user: { id: "fixture" } });
    await expect(Page({ searchParams: Promise.resolve({ next }) })).rejects.toThrow("/admin");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin");
  },
);
it("operator 요청은 활성 상태에서만 승인 화면으로 복귀한다", async () => {
  mocks.context.mockResolvedValue({ user: { id: "fixture" } });
  vi.stubEnv("CONSOLE_OPERATOR_ENABLED", "true");
  await expect(Page({ searchParams: Promise.resolve({ next: "operator" }) })).rejects.toThrow(
    "/operator-connect",
  );
  vi.stubEnv("CONSOLE_OPERATOR_ENABLED", "false");
  await expect(Page({ searchParams: Promise.resolve({ next: "operator" }) })).rejects.toThrow(
    "/admin",
  );
});
