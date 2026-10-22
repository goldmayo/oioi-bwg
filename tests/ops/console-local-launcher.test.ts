import { describe, expect, it } from "vitest";

import { validateLocalConsoleEnvironment } from "../../scripts/dev-console-local.mts";

const local = {
  DATABASE_URL: "postgresql://oioibawige:local-only@127.0.0.1:5432/oioibawige",
  CONSOLE_ORIGIN: "http://127.0.0.1:3001",
  CONSOLE_AUTH_SECRET: "local-signing-secret-with-at-least-32-characters",
  CONSOLE_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  CONSOLE_MFA_ENROLLMENT_ENABLED: "true",
  R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  R2_BUCKET: "fixture-albums",
  R2_ACCESS_KEY_ID: "fixture-r2-access-key",
  R2_SECRET_ACCESS_KEY: "fixture-r2-secret-key",
  ASSETS_PUBLIC_BASE_URL: "https://assets.example.test",
};

describe("Console 로컬 실행 경계", () => {
  it("Compose 설정과 등록 닫힘 설정을 허용한다", () => {
    expect(() => validateLocalConsoleEnvironment(local)).not.toThrow();
    expect(() =>
      validateLocalConsoleEnvironment({ ...local, CONSOLE_MFA_ENROLLMENT_ENABLED: "false" }),
    ).not.toThrow();
  });

  it.each([
    "R2_ENDPOINT",
    "R2_BUCKET",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "ASSETS_PUBLIC_BASE_URL",
  ])("업로드 설정 누락 시 실행 전에 키 이름만 안내한다", (name) => {
    expect(() => validateLocalConsoleEnvironment({ ...local, [name]: "" })).toThrow(name);
  });

  it.each(["R2_ENDPOINT", "ASSETS_PUBLIC_BASE_URL"])(
    "자격증명이 포함되거나 HTTPS가 아닌 업로드 URL을 거절한다",
    (name) => {
      for (const value of [
        "http://example.test",
        "https://private-value@example.test",
        "private-value",
      ]) {
        try {
          validateLocalConsoleEnvironment({ ...local, [name]: value });
          expect.fail("잘못된 URL이 거절돼야 합니다.");
        } catch (error) {
          expect((error as Error).message).toContain(name);
          expect((error as Error).message).not.toContain("private-value");
        }
      }
    },
  );

  it.each([
    "postgresql://owner:private-value@db.example.test:5432/oioibawige",
    "postgresql://owner:private-value@127.0.0.1:5432/production",
    "postgresql://owner:private-value@127.0.0.1:5433/oioibawige",
    "postgresql://oioibawige@127.0.0.1:5432/oioibawige",
    "postgresql://oioibawige:private-value@127.0.0.1:5432/oioibawige?host=db.example.test",
    "private-value",
    "",
  ])("잘못된 DB 대상/입력을 거절하고 credential을 노출하지 않는다", (url) => {
    try {
      validateLocalConsoleEnvironment({ ...local, DATABASE_URL: url });
      expect.fail("DB 대상이 거절돼야 합니다.");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain("private-value");
      expect((error as Error).message).toContain("Console");
    }
  });

  it.each(["http://example.test:3001", "http://127.0.0.1:3002", ""])(
    "실제 dev 서버와 다른 Origin을 거절한다",
    (origin) => {
      expect(() => validateLocalConsoleEnvironment({ ...local, CONSOLE_ORIGIN: origin })).toThrow(
        "CONSOLE_ORIGIN",
      );
    },
  );

  it.each([
    { CONSOLE_AUTH_SECRET: "" },
    { AUTH_SECRET: local.CONSOLE_AUTH_SECRET },
    { CONSOLE_MFA_ENCRYPTION_KEY: local.CONSOLE_MFA_ENCRYPTION_KEY + "\n" },
    { CONSOLE_AUTH_SECRET: local.CONSOLE_MFA_ENCRYPTION_KEY },
    { CONSOLE_MFA_ENROLLMENT_ENABLED: "tru" },
  ])("누락/재사용/잘못된 키와 등록 설정을 거절한다", (invalid) => {
    expect(() => validateLocalConsoleEnvironment({ ...local, ...invalid })).toThrow();
  });
});
