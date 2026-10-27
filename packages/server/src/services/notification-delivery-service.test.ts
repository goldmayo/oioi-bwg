import { expect, test } from "vitest";
import { pushRetryDelay } from "./notification-delivery-service";

test("재시도는 backoff와 jitter를 적용하고 Retry-After를 존중한다", () => {
  expect(pushRetryDelay(1, 0, 0)).toBe(7500);
  expect(pushRetryDelay(2, 0, 0.5)).toBe(20_000);
  expect(pushRetryDelay(1000, 0, 1)).toBe(3600_000);
  expect(pushRetryDelay(1, 7200_000, 0)).toBe(7200_000);
});
