import { generateSync } from "otplib";

import { AdminMfaTotpError, generateAdminMfaSecret, verifyAdminMfaTotp } from "./admin-mfa-totp";

const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const epoch = 1_234_567_890;
const step = epoch / 30;
const tokenAt = (time: number) =>
  generateSync({ secret, epoch: time, algorithm: "sha1", digits: 6, period: 30 });

describe("AUTH-009 Console MFA TOTP verification", () => {
  it("generates distinct 160-bit Base32 secrets", () => {
    const first = generateAdminMfaSecret();
    expect(first).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateAdminMfaSecret()).not.toEqual(first);
    expect(verifyAdminMfaTotp(first, generateSync({ secret: first, epoch }), epoch)).toBe(step);
  });

  it("verifies the six-digit RFC 6238 SHA-1 token and returns the actual matched step", () => {
    expect(verifyAdminMfaTotp(secret, "005924", epoch)).toBe(step);
    expect(verifyAdminMfaTotp(secret, "005924", epoch + 30)).toBe(step);
    expect(verifyAdminMfaTotp(secret, "005924", epoch - 30)).toBe(step);
  });

  it("accepts adjacent steps, rejects outside the tolerance, and respects step boundaries", () => {
    for (const offset of [-30, 0, 30]) {
      expect(verifyAdminMfaTotp(secret, tokenAt(epoch + offset), epoch)).toBe(step + offset / 30);
    }
    for (const offset of [-60, 60]) {
      expect(verifyAdminMfaTotp(secret, tokenAt(epoch + offset), epoch)).toBeNull();
    }
    expect(verifyAdminMfaTotp(secret, tokenAt(epoch), epoch + 59)).toBe(step);
    expect(verifyAdminMfaTotp(secret, tokenAt(epoch), epoch + 60)).toBeNull();
  });

  it("rejects used or older steps but does not claim to consume them in the DB", () => {
    expect(verifyAdminMfaTotp(secret, tokenAt(epoch), epoch, step)).toBeNull();
    expect(verifyAdminMfaTotp(secret, tokenAt(epoch - 30), epoch, step)).toBeNull();
    expect(verifyAdminMfaTotp(secret, tokenAt(epoch + 30), epoch, step)).toBe(step + 1);
  });

  it("rejects malformed and invalid tokens without coercing them", () => {
    for (const token of [
      "",
      "00592",
      "0059240",
      " 005924",
      "005924\n",
      "ABCDEF",
      "００５９２４",
      "000000",
    ]) {
      expect(verifyAdminMfaTotp(secret, token, epoch)).toBeNull();
    }
  });

  it("fails closed with sanitized errors for invalid secret or server parameters", () => {
    for (const operation of [
      () => verifyAdminMfaTotp("!", "005924", epoch),
      () => verifyAdminMfaTotp(secret, "005924", NaN),
      () => verifyAdminMfaTotp(secret, "005924", epoch, -1),
    ]) {
      expect(operation).toThrow(AdminMfaTotpError);
      expect(operation).toThrow("Console MFA TOTP 처리 실패");
    }
  });
});
