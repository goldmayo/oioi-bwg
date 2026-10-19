import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

import { getConsoleOrigin } from "@/shared/config/console-runtime";

const duration = 300;
const maxAccounts = 1_024;
type Window = { expiresAt: number };
type LimiterState = {
  account: RateLimiterMemory;
  ip: RateLimiterMemory;
  accounts: Map<string, Window>;
  response: typeof RateLimiterRes;
  ips: Map<string, Window>;
};
// Next의 서로 다른 route/Action bundle에서도 같은 프로세스 예약을 사용한다.
const processGlobal = globalThis as typeof globalThis & {
  __oioiConsoleMfaLimiter?: LimiterState;
};
const state: LimiterState = (processGlobal.__oioiConsoleMfaLimiter ??= {
  account: new RateLimiterMemory({ points: 5, duration }),
  ip: new RateLimiterMemory({ points: 20, duration }),
  accounts: new Map(),
  ips: new Map(),
  response: RateLimiterRes,
});

export class ConsoleMfaRateLimited extends Error {
  readonly retryAfterSeconds: number;

  constructor(msBeforeNext: number) {
    super("Console MFA attempt limit exceeded");
    this.retryAfterSeconds = Math.max(1, Math.ceil(msBeforeNext / 1_000));
  }
}

function translateLimit(error: unknown): never {
  if (error instanceof state.response) throw new ConsoleMfaRateLimited(error.msBeforeNext);
  throw error;
}

/** HTTPS host loopback upstream에서 Caddy가 덮어쓴 단일 값만 사용한다. */
export function getConsoleClientIp(headers?: Headers) {
  const origin = new URL(getConsoleOrigin());
  if (
    origin.protocol !== "https:" ||
    headers?.get("host") !== origin.host ||
    headers.get("x-forwarded-host") !== origin.host ||
    headers.get("x-forwarded-proto") !== "https"
  )
    return "unknown";
  const value = headers.get("x-console-client-ip") ?? "";
  const family = isIP(value);
  if (family === 4) return value;
  if (family === 6 && !value.includes("%")) {
    const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
    // IPv4-mapped IPv6와 IPv4를 같은 bucket에 넣는다.
    const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(normalized);
    if (mapped) {
      const bytes = mapped.slice(1).map((part) => parseInt(part, 16));
      return [bytes[0] >> 8, bytes[0] & 255, bytes[1] >> 8, bytes[1] & 255].join(".");
    }
    return normalized;
  }
  return "unknown";
}

function refundIp(key: string, window: Window) {
  if (state.ips.get(key) === window && window.expiresAt > Date.now())
    return state.ip.reward(key, 1);
}

/** 실패는 유지한다. 반환된 함수는 성공한 요청 자신의 예약만 한 번 환급한다. */
export async function reserveConsoleMfaAttempt(email: string, headers?: Headers) {
  const now = Date.now();
  for (const [key, window] of state.ips) {
    if (window.expiresAt <= now) {
      state.ips.delete(key);
      void state.ip.delete(key);
    }
  }
  let ipKey = getConsoleClientIp(headers);
  // 메모리 상한에 도달하면 새 IP도 제한된 공통 bucket을 사용한다.
  if (!state.ips.has(ipKey) && state.ips.size >= 4_096) ipKey = "unknown";
  let ipWindow = state.ips.get(ipKey);
  if (!ipWindow) {
    ipWindow = { expiresAt: now + duration * 1_000 };
    state.ips.set(ipKey, ipWindow);
  }
  try {
    await state.ip.consume(ipKey);
  } catch (error) {
    if (error instanceof state.response) await refundIp(ipKey, ipWindow);
    translateLimit(error);
  }

  const key = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  try {
    for (const [expiredKey, window] of state.accounts) {
      if (window.expiresAt <= Date.now()) {
        state.accounts.delete(expiredKey);
        void state.account.delete(expiredKey);
      }
    }
    let window = state.accounts.get(key);
    if (!window) {
      if (state.accounts.size >= maxAccounts)
        throw new ConsoleMfaRateLimited(
          Math.min(...Array.from(state.accounts.values(), (value) => value.expiresAt)) - Date.now(),
        );
      window = { expiresAt: Date.now() + duration * 1_000 };
      state.accounts.set(key, window);
    }
    try {
      await state.account.consume(key);
    } catch (error) {
      if (error instanceof state.response && window.expiresAt > Date.now())
        await state.account.reward(key, 1);
      throw error;
    }
    let refunded = false;
    return async () => {
      if (refunded) return;
      refunded = true;
      await refundIp(ipKey, ipWindow);
      if (state.accounts.get(key) === window && window.expiresAt > Date.now())
        await state.account.reward(key, 1);
    };
  } catch (error) {
    await refundIp(ipKey, ipWindow);
    translateLimit(error);
  }
}
