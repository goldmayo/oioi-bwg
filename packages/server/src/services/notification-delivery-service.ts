import "server-only";
import { getDatabase } from "../db";
import { createEntityId } from "../db/entity-id";
import {
  claimNotificationDelivery,
  discardPushRegistration,
  findDeliveryTarget,
  finishNotificationDelivery,
} from "../repositories/notification-delivery-repository";

export type PushTarget = NonNullable<Awaited<ReturnType<typeof findDeliveryTarget>>>;
export class PushDeliveryError extends Error {
  constructor(
    readonly code:
      | "UNREGISTERED"
      | "AUTHENTICATION"
      | "INVALID_MESSAGE"
      | "QUOTA"
      | "NETWORK"
      | "EXPIRED",
    readonly retryAfterMs = 0,
  ) {
    super(code);
  }
}
export function pushRetryDelay(attempt: number, retryAfterMs: number, random = Math.random()) {
  return Math.max(
    retryAfterMs,
    Math.min(3600_000, 10_000 * 2 ** Math.min(attempt - 1, 9) * (0.75 + random * 0.5)),
  );
}
/** 기기별 한 건씩 claim하고 짧은 DB 작업 밖에서 발송한다. crash는 lease 만료 뒤 회수한다. */
export async function dispatchNotifications(
  send: (target: PushTarget) => Promise<void>,
  onError: (code: string) => void = () => {},
) {
  const db = getDatabase();
  let processed = 0;
  for (; processed < 20; processed++) {
    const leaseToken = createEntityId();
    const pending = await claimNotificationDelivery(db, leaseToken);
    if (!pending) break;
    const target = await findDeliveryTarget(db, pending.id, leaseToken);
    if (!target) {
      await finishNotificationDelivery(db, pending.id, leaseToken, {
        status: "DISCARDED",
        lastErrorCode: "INELIGIBLE",
      });
      continue;
    }
    try {
      await send(target);
      await finishNotificationDelivery(db, pending.id, leaseToken, {
        status: "ACCEPTED",
        acceptedAt: new Date().toISOString(),
        lastErrorCode: null,
      });
    } catch (error) {
      const failure = error instanceof PushDeliveryError ? error : new PushDeliveryError("NETWORK");
      if (failure.code === "UNREGISTERED")
        await discardPushRegistration(db, target.installationId, target.bindingVersion);
      const next = Date.now() + pushRetryDelay(pending.attemptCount, failure.retryAfterMs);
      const permanent =
        ["UNREGISTERED", "INVALID_MESSAGE", "EXPIRED"].includes(failure.code) ||
        next >= new Date(pending.expiresAt).getTime();
      await finishNotificationDelivery(db, pending.id, leaseToken, {
        status: permanent ? "DISCARDED" : "PENDING",
        nextAttemptAt: new Date(next).toISOString(),
        lastErrorCode: failure.code,
      });
      onError(failure.code);
    }
  }
  return processed;
}
