import { describe, expect, it } from "vitest";

import {
  notificationHistoryInputSchema,
  notificationListInputSchema,
  notificationPushSchema,
  pushInstallationInputSchema,
} from "./notification";

describe("알림 HTTP 입력", () => {
  it("내역은 기본 10개이며 페이지 범위와 중첩 필터를 검증한다", () => {
    expect(notificationHistoryInputSchema.parse({})).toEqual({
      limit: 10,
      offset: 0,
      status: "all",
    });
    expect(
      notificationHistoryInputSchema.parse({
        limit: "20",
        offset: "40",
        status: "unread",
        type: "WAVEFORM_FAILED",
      }),
    ).toEqual({ limit: 20, offset: 40, status: "unread", type: "WAVEFORM_FAILED" });
    for (const input of [
      { offset: -1 },
      { offset: 0.5 },
      { limit: 51 },
      { status: "read" },
      { type: "OTHER" },
    ]) {
      expect(notificationHistoryInputSchema.safeParse(input).success).toBe(false);
    }
  });
  it("목록 요청 크기와 cursor 길이를 제한한다", () => {
    expect(notificationListInputSchema.parse({})).toEqual({ limit: 20 });
    for (const limit of [0, 51, 1.5, "bad"])
      expect(notificationListInputSchema.safeParse({ limit }).success).toBe(false);
    expect(notificationListInputSchema.safeParse({ cursor: "x".repeat(513) }).success).toBe(false);
  });
  it("푸시를 알림 식별자로 제한하고 잘못된 등록 식별자를 거절한다", () => {
    expect(notificationPushSchema.safeParse({ notificationId: "not-an-id" }).success).toBe(false);
    expect(pushInstallationInputSchema.safeParse({ fid: "../../other" }).success).toBe(false);
    expect(
      pushInstallationInputSchema.parse({ fid: "c1234567890123456789012", accountId: "other" }),
    ).toEqual({ fid: "c1234567890123456789012" });
  });
});
