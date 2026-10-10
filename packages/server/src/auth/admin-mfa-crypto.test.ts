import { randomBytes } from "node:crypto";

import {
  AdminMfaCryptoError,
  decryptAdminMfaSecret,
  encryptAdminMfaSecret,
  parseAdminMfaKey,
} from "./admin-mfa-crypto";

const key = Buffer.alloc(32, 7);
const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("AUTH-009 Console MFA secret encryption", () => {
  it("requires a canonical Base64 32-byte key", () => {
    expect(parseAdminMfaKey(key.toString("base64"))).toEqual(key);
    for (const value of [
      "",
      key.toString("base64").slice(0, -1),
      `${key.toString("base64")}\n`,
      Buffer.alloc(31).toString("base64"),
      Buffer.alloc(33).toString("base64"),
    ]) {
      expect(() => parseAdminMfaKey(value)).toThrow(AdminMfaCryptoError);
    }
  });

  it("round trips with fresh 12-byte nonces and 16-byte tags without plaintext", () => {
    const first = encryptAdminMfaSecret(1n, secret, key);
    const second = encryptAdminMfaSecret(1n, secret, key);
    expect(first).not.toEqual(second);
    expect(first).not.toContain(secret);
    const parts = first.split(".");
    expect(parts[0]).toBe("v1");
    expect(Buffer.from(parts[1]!, "base64url")).toHaveLength(12);
    expect(Buffer.from(parts[2]!, "base64url")).toHaveLength(16);
    expect(decryptAdminMfaSecret(1n, first, key)).toBe(secret);
    expect(decryptAdminMfaSecret(1n, second, key)).toBe(secret);
  });

  it("rejects ciphertext transfer between accounts, wrong keys, and invalid key lengths", () => {
    const envelope = encryptAdminMfaSecret(1n, secret, key);
    expect(() => decryptAdminMfaSecret(2n, envelope, key)).toThrow(AdminMfaCryptoError);
    expect(() => decryptAdminMfaSecret(1n, envelope, randomBytes(32))).toThrow(AdminMfaCryptoError);
    expect(() => decryptAdminMfaSecret(1n, envelope, Buffer.alloc(16))).toThrow(
      AdminMfaCryptoError,
    );
    expect(() => encryptAdminMfaSecret(1n, secret, Buffer.alloc(16))).toThrow(AdminMfaCryptoError);
  });

  it("rejects tampered nonce, tag, and ciphertext with sanitized errors", () => {
    const envelope = encryptAdminMfaSecret(1n, secret, key);
    for (const index of [1, 2, 3]) {
      const parts = envelope.split(".");
      const bytes = Buffer.from(parts[index]!, "base64url");
      bytes[0] = bytes[0]! ^ 1;
      parts[index] = bytes.toString("base64url");
      try {
        decryptAdminMfaSecret(1n, parts.join("."), key);
        throw new Error("변조를 거절해야 함");
      } catch (error) {
        expect(error).toBeInstanceOf(AdminMfaCryptoError);
        expect((error as Error).message).toBe("Console MFA 암호화 처리 실패");
        expect(error).not.toHaveProperty("cause");
      }
    }
  });

  it("rejects unknown formats, malformed segments, and extra/truncated parts", () => {
    const envelope = encryptAdminMfaSecret(1n, secret, key);
    for (const value of [
      "",
      envelope.replace("v1.", "v2."),
      `${envelope}.extra`,
      envelope.split(".").slice(0, 3).join("."),
      envelope.replace("v1.", "v1.."),
      envelope.replace("v1.", "v1.!"),
      `${envelope}=`,
    ]) {
      expect(() => decryptAdminMfaSecret(1n, value, key)).toThrow(AdminMfaCryptoError);
    }
    expect(() => encryptAdminMfaSecret(1n, "", key)).toThrow(AdminMfaCryptoError);
  });
});
