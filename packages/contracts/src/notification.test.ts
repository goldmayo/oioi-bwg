import { describe, expect, it } from "vitest";

import {
  notificationListInputSchema,
  notificationPushSchema,
  pushInstallationInputSchema,
} from "./notification";

describe("알림 HTTP 입력", () => {
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
