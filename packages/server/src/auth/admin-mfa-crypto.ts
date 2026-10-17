import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class AdminMfaCryptoError extends Error {
  constructor() {
    super("Console MFA 암호화 처리 실패");
    this.name = "AdminMfaCryptoError";
  }
}

export function parseAdminMfaKey(value: string): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) throw new AdminMfaCryptoError();
  return key;
}

function decodePart(value: string, length?: number) {
  const bytes = Buffer.from(value, "base64url");
  if (
    !value ||
    bytes.toString("base64url") !== value ||
    (length !== undefined && bytes.length !== length)
  ) {
    throw new AdminMfaCryptoError();
  }
  return bytes;
}

function associatedData(accountId: bigint) {
  return Buffer.from(`oioi-bwg:console-mfa:v1:${accountId}`);
}

export function encryptAdminMfaSecret(accountId: bigint, secret: string, key: Uint8Array): string {
  try {
    if (key.length !== 32 || !secret) throw new AdminMfaCryptoError();
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
    cipher.setAAD(associatedData(accountId));
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    return [
      "v1",
      nonce.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  } catch {
    throw new AdminMfaCryptoError();
  }
}

export function decryptAdminMfaSecret(
  accountId: bigint,
  envelope: string,
  key: Uint8Array,
): string {
  try {
    const [format, nonce, tag, ciphertext, extra] = envelope.split(".");
    if (
      key.length !== 32 ||
      format !== "v1" ||
      !nonce ||
      !tag ||
      !ciphertext ||
      extra !== undefined
    ) {
      throw new AdminMfaCryptoError();
    }
    const decipher = createDecipheriv("aes-256-gcm", key, decodePart(nonce, 12), {
      authTagLength: 16,
    });
    decipher.setAAD(associatedData(accountId));
    decipher.setAuthTag(decodePart(tag, 16));
    return Buffer.concat([decipher.update(decodePart(ciphertext)), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new AdminMfaCryptoError();
  }
}
