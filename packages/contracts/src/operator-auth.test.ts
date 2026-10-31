import { expect, it } from "vitest";
import {
  operatorApprovalInputSchema,
  operatorDeviceGrantSchema,
  operatorExchangeInputSchema,
  operatorExchangeResultSchema,
} from "./operator-auth";

it("연결 코드는 정규화하지만 client가 권한·계정을 전달할 수 없다", () => {
  expect(operatorApprovalInputSchema.parse({ userCode: " abcd-2345 " })).toEqual({
    userCode: "ABCD-2345",
  });
  expect(
    operatorApprovalInputSchema.safeParse({ userCode: "ABCD-2345", accountId: "another" }).success,
  ).toBe(false);
  expect(
    operatorExchangeInputSchema.safeParse({ deviceCode: "a".repeat(64), mfaVersion: 1 }).success,
  ).toBe(false);
  expect(operatorExchangeInputSchema.safeParse({ deviceCode: "short" }).success).toBe(false);
});
it("대기 응답과 한 번 발급하는 token 응답을 엄격히 구분한다", () => {
  expect(operatorExchangeResultSchema.parse({ status: "pending" })).toEqual({ status: "pending" });
  expect(
    operatorExchangeResultSchema.safeParse({
      status: "pending",
      accessToken: "oioi_" + "a".repeat(64),
    }).success,
  ).toBe(false);
  expect(
    operatorExchangeResultSchema.parse({
      status: "authorized",
      accessToken: "oioi_" + "a".repeat(64),
      expiresAt: "2026-10-31T08:00:00Z",
    }).status,
  ).toBe("authorized");
  expect(
    operatorDeviceGrantSchema.safeParse({
      deviceCode: "a".repeat(64),
      userCode: "ABCD-2345",
      expiresAt: "2026-10-31T00:10:00Z",
      intervalSeconds: 0,
    }).success,
  ).toBe(false);
});
