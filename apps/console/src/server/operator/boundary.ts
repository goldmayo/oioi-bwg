import "server-only";

import { createHash } from "node:crypto";

import { AppError } from "@oioi-bwg/server/errors/app-error";

import { getConsoleClientIp } from "@/server/auth/console-mfa-limiter";

import { isConsoleOperatorEnabled } from "@/shared/config/console-runtime";

const quotas = {
  create: [5, 60000],
  approve: [10, 60000],
  pollIp: [60, 60000],
  pollDevice: [1, 5000],
} as const;
export class OperatorQuotaExceeded extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super("OPERATOR_RATE_LIMITED");
  }
}
type Bucket = { count: number; expiresAt: number };
const processState = globalThis as typeof globalThis & {
  __oioiOperatorLimits?: Map<string, Bucket>;
};
/** 연결 데이터는 DB에 두고 여기에는 해시한 유한 개 빈도 정보만 유지한다. */
export function takeOperatorQuota(kind: keyof typeof quotas, identity: string) {
  const buckets = (processState.__oioiOperatorLimits ??= new Map<string, Bucket>());
  const now = Date.now();
  for (const [key, value] of buckets) if (value.expiresAt <= now) buckets.delete(key);
  const key = kind + ":" + createHash("sha256").update(identity).digest("hex");
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= 4096) throw new OperatorQuotaExceeded(60);
    bucket = { count: 0, expiresAt: now + quotas[kind][1] };
    buckets.set(key, bucket);
  }
  if (bucket.count >= quotas[kind][0])
    throw new OperatorQuotaExceeded(Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)));
  bucket.count++;
}
export function assertOperatorEnabled() {
  if (!isConsoleOperatorEnabled()) throw new AppError("FORBIDDEN");
}
export function assertOperatorCliRequest(request: Request) {
  assertOperatorEnabled();
  if (request.headers.has("origin") || request.headers.has("cookie"))
    throw new AppError("FORBIDDEN");
}
export function operatorClientIp(request: Request) {
  return getConsoleClientIp(request.headers);
}
export function getOperatorToken(request: Request) {
  assertOperatorCliRequest(request);
  const value = request.headers.get("authorization") ?? "";
  const match = /^Bearer (oioi_[a-f0-9]{64})$/.exec(value);
  if (!match) throw new AppError("UNAUTHENTICATED");
  return match[1]!;
}
export function operatorNoStore(response: Response, error?: unknown) {
  response.headers.set("Cache-Control", "no-store");
  if (response.status === 429)
    response.headers.set(
      "Retry-After",
      String(error instanceof OperatorQuotaExceeded ? error.retryAfterSeconds : 5),
    );
  return response;
}
