import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportAuthError } from "@/server/observability/auth-error-reporter";
import { reportServerError } from "@/server/observability/server-error-reporter";

vi.mock("@/server/observability/server-error-reporter", () => ({ reportServerError: vi.fn() }));

vi.mock("next-auth", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  // Next runtime 전용 index 대신 동일한 실제 Auth.js 오류 클래스를 읽는다.
  const errors = await import(
    createRequire(require.resolve("next-auth")).resolve("@auth/core/errors")
  );
  return {
    ...errors,
    default: () => ({ signIn: authSignIn, signOut: authSignOut, auth: vi.fn(), handlers: {} }),
  };
});
const authSignIn = vi.hoisted(() => vi.fn());
const authSignOut = vi.hoisted(() => vi.fn());
const getHeaders = vi.hoisted(() => vi.fn());
vi.mock("@/server/auth/authenticate-console", () => ({ authenticateConsole: vi.fn() }));
vi.mock("next/headers", () => ({ headers: getHeaders }));

let limiter: typeof import("./console-mfa-limiter");
beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  Reflect.deleteProperty(globalThis, "__oioiConsoleMfaLimiter");
  vi.resetModules();
  vi.clearAllMocks();
  getHeaders.mockResolvedValue(new Headers({ Origin: "http://127.0.0.1:3001" }));
  limiter = await import("./console-mfa-limiter");
});
afterEach(() => vi.useRealTimers());

describe("Console MFA 예약", () => {
  it("정규화한 한 계정의 동시 요청은 정확히 다섯 건만 허용한다", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        limiter.reserveConsoleMfaAttempt(i % 2 ? " ADMIN@example.test " : "admin@example.test"),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason).toBeInstanceOf(limiter.ConsoleMfaRateLimited);
        expect(result.reason.retryAfterSeconds).toBe(300);
      }
    }
  });

  it("초과 거절은 예약으로 남지 않아 성공한 동시 요청 뒤 다시 시도할 수 있다", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => limiter.reserveConsoleMfaAttempt("admin@example.test")),
    );
    for (const result of results) if (result.status === "fulfilled") await result.value();
    for (let i = 0; i < 5; i++) await limiter.reserveConsoleMfaAttempt("admin@example.test");
  });

  it("계정을 바꿔도 공통 IP 예약 스무 건을 우회하지 못한다", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) => limiter.reserveConsoleMfaAttempt(`${i}@example.test`)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(20);
  });

  it("성공은 자신의 예약만 한 번 환급하고 다른 실패는 보존한다", async () => {
    const successes = await Promise.all(
      Array.from({ length: 5 }, () => limiter.reserveConsoleMfaAttempt("admin@example.test")),
    );
    await successes[0]();
    await successes[0]();
    await limiter.reserveConsoleMfaAttempt("admin@example.test");
    await expect(limiter.reserveConsoleMfaAttempt("admin@example.test")).rejects.toBeInstanceOf(
      limiter.ConsoleMfaRateLimited,
    );
    // 계정 초과에서 예약한 IP는 환급하므로 남은 15건은 다른 계정에 사용 가능하다.
    for (let i = 0; i < 15; i++) await limiter.reserveConsoleMfaAttempt(`${i}@example.test`);
    await expect(limiter.reserveConsoleMfaAttempt("other@example.test")).rejects.toBeInstanceOf(
      limiter.ConsoleMfaRateLimited,
    );
  });

  it("만료된 예약의 늦은 성공이 새 window의 실패를 환급하지 않는다", async () => {
    const lateSuccess = await limiter.reserveConsoleMfaAttempt("admin@example.test");
    await vi.advanceTimersByTimeAsync(300_000);
    for (let i = 0; i < 5; i++) await limiter.reserveConsoleMfaAttempt("admin@example.test");
    await lateSuccess();
    await expect(limiter.reserveConsoleMfaAttempt("admin@example.test")).rejects.toBeInstanceOf(
      limiter.ConsoleMfaRateLimited,
    );
    for (let i = 0; i < 15; i++) await limiter.reserveConsoleMfaAttempt(`${i}@example.test`);
    await expect(limiter.reserveConsoleMfaAttempt("other@example.test")).rejects.toBeInstanceOf(
      limiter.ConsoleMfaRateLimited,
    );
  });

  it("성공이 많아도 계정 key 상한을 유지하고 TTL 이후 공간을 회수한다", async () => {
    for (let i = 0; i < 1_024; i++) {
      const refund = await limiter.reserveConsoleMfaAttempt(`${i}@example.test`);
      await refund();
    }
    await expect(limiter.reserveConsoleMfaAttempt("overflow@example.test")).rejects.toMatchObject({
      retryAfterSeconds: 300,
    });
    await vi.advanceTimersByTimeAsync(300_000);
    await expect(limiter.reserveConsoleMfaAttempt("overflow@example.test")).resolves.toBeTypeOf(
      "function",
    );
  });

  it("Next의 다른 bundle에서 다시 읽어도 기존 제한을 유지한다", async () => {
    for (let i = 0; i < 5; i++) await limiter.reserveConsoleMfaAttempt("admin@example.test");
    vi.resetModules();
    const secondBundle = await import("./console-mfa-limiter");
    await expect(secondBundle.reserveConsoleMfaAttempt("admin@example.test")).rejects.toMatchObject(
      {
        retryAfterSeconds: 300,
      },
    );
  });

  it("Auth adapter만 예상 제한을 CredentialsSignin으로 변환하고 내부 장애 보고에서 제외한다", async () => {
    const { LoginRateLimited } = await import("@/auth");
    const error = new LoginRateLimited(2);
    expect(error).toMatchObject({
      type: "CredentialsSignin",
      code: "rate_limited",
      retryAfterSeconds: 2,
    });
    reportAuthError(error);
    expect(reportServerError).not.toHaveBeenCalled();
  });
});

describe("로그인/로그아웃 Action 경계", () => {
  it("예상 제한을 일반 credentials 실패보다 먼저 대기 응답으로 번역한다", async () => {
    const { signIn, LoginRateLimited } = await import("@/auth");
    authSignIn.mockRejectedValue(new LoginRateLimited(2));
    await expect(signIn(new FormData())).resolves.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 2,
    });
  });
  it("Origin을 거절하면 Auth.js를 호출하지 않는다", async () => {
    const { signIn, signOut } = await import("@/auth");
    getHeaders.mockResolvedValue(new Headers());
    await expect(signIn(new FormData())).resolves.toEqual({
      error: "요청 출처를 확인할 수 없습니다.",
    });
    await expect(signOut()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(authSignIn).not.toHaveBeenCalled();
    expect(authSignOut).not.toHaveBeenCalled();
  });
  it("내부 오류를 rate limit으로 바꾸지 않는다", async () => {
    const { signIn } = await import("@/auth");
    const internal = new Error("internal failure");
    authSignIn.mockRejectedValue(internal);
    await expect(signIn(new FormData())).rejects.toBe(internal);
  });
});
