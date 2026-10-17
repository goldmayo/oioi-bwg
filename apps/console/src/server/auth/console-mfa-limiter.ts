import "server-only";

import { createHash } from "node:crypto";

import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

const duration = 300;
const maxAccounts = 1_024;
type Window = { expiresAt: number };
type LimiterState = {
  account: RateLimiterMemory;
  ip: RateLimiterMemory;
  accounts: Map<string, Window>;
  response: typeof RateLimiterRes;
  ipWindow?: Window;
};
// Next의 서로 다른 route/Action bundle에서도 같은 프로세스 예약을 사용한다.
const processGlobal = globalThis as typeof globalThis & {
  __oioiConsoleMfaLimiter?: LimiterState;
};
const state: LimiterState = (processGlobal.__oioiConsoleMfaLimiter ??= {
  account: new RateLimiterMemory({ points: 5, duration }),
  ip: new RateLimiterMemory({ points: 20, duration }),
  accounts: new Map(),
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

/** 예약한 window가 동일하고 유효할 때만 자신의 1건을 환급한다. */
function refundIp(window: Window) {
  if (state.ipWindow === window && window.expiresAt > Date.now())
    return state.ip.reward("unknown", 1);
}

/** 실패는 유지한다. 반환된 함수는 성공한 요청 자신의 예약만 한 번 환급한다. */
export async function reserveConsoleMfaAttempt(email: string) {
  const now = Date.now();
  if (!state.ipWindow || state.ipWindow.expiresAt <= now) {
    void state.ip.delete("unknown");
    state.ipWindow = { expiresAt: now + duration * 1_000 };
  }
  const ipWindow = state.ipWindow;
  try {
    await state.ip.consume("unknown");
  } catch (error) {
    if (error instanceof state.response) await refundIp(ipWindow);
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
      await refundIp(ipWindow);
      if (state.accounts.get(key) === window && window.expiresAt > Date.now())
        await state.account.reward(key, 1);
    };
  } catch (error) {
    await refundIp(ipWindow);
    translateLimit(error);
  }
}
