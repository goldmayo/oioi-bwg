import { expect, it } from "vitest";

import { formatNotificationTime } from "./notification-time";

it("실행 환경과 무관하게 한국 시각과 고정 자릿수를 표시한다", () => {
  expect(formatNotificationTime("2026-02-01T15:04:00.000Z")).toBe("2026.02.02 00:04");
  expect(formatNotificationTime("2026-01-31T23:59:00.000Z")).toBe("2026.02.01 08:59");
});
