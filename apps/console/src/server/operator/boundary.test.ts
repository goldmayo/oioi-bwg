import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { takeOperatorQuota } from "./boundary";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-31T00:00:00Z"));
  Reflect.deleteProperty(globalThis, "__oioiOperatorLimits");
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, "__oioiOperatorLimits");
});
it("poll 간격은 정확한 경계에서 회복되며 원문 identity를 state에 저장하지 않는다", () => {
  takeOperatorQuota("pollDevice", "private-device-code");
  expect(() => takeOperatorQuota("pollDevice", "private-device-code")).toThrow();
  vi.advanceTimersByTime(5000);
  expect(() => takeOperatorQuota("pollDevice", "private-device-code")).not.toThrow();
  const state = Reflect.get(globalThis, "__oioiOperatorLimits") as Map<string, unknown>;
  expect([...state.keys()].join()).not.toContain("private-device-code");
});
it("새 identity 입력도 메모리 상한을 넘기지 않고 만료된 bucket은 회수한다", () => {
  for (let i = 0; i < 4096; i++) takeOperatorQuota("pollDevice", String(i));
  expect(() => takeOperatorQuota("pollDevice", "overflow")).toThrow();
  expect((Reflect.get(globalThis, "__oioiOperatorLimits") as Map<string, unknown>).size).toBe(4096);
  vi.advanceTimersByTime(5000);
  expect(() => takeOperatorQuota("pollDevice", "new")).not.toThrow();
  expect((Reflect.get(globalThis, "__oioiOperatorLimits") as Map<string, unknown>).size).toBe(1);
});
