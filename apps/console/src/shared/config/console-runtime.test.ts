import { describe, expect, it } from "vitest";

import { getConsoleCookies, getConsoleRuntimeConfig } from "./console-runtime";

const secret = "console-local-test-secret-at-least-32-chars";
describe("Console runtime isolation", () => {
  it("requires a dedicated secret and accepts a loopback origin", () => {
    expect(getConsoleRuntimeConfig({ CONSOLE_AUTH_SECRET: secret })).toEqual({
      origin: "http://127.0.0.1:3001",
      secret,
    });
    for (const env of [
      {},
      { CONSOLE_AUTH_SECRET: "short" },
      { CONSOLE_AUTH_SECRET: secret, AUTH_SECRET: secret },
    ]) {
      expect(() => getConsoleRuntimeConfig(env)).toThrow();
    }
  });
  it.each([
    "https://user:pass@console.example.com",
    "https://console.example.com?",
    "https://console.example.com#",
    "https://console.example.com/admin",
    "https://console.example.com/?q=1",
    "https://console.example.com/#hash",
    "https://console.example.com:0",
    " https://console.example.com",
    "https:console.example.com",
    "http://example.com",
    "http://localhost.evil.test",
    "http://user@localhost",
    "http://localhost/admin",
  ])("rejects an invalid origin: %s", (origin) => {
    expect(() =>
      getConsoleRuntimeConfig({ CONSOLE_AUTH_SECRET: secret, CONSOLE_ORIGIN: origin }),
    ).toThrow();
  });
  it.each(["https://console.example.com", "https://console.example.com:8443", "http://[::1]:3001"])(
    "accepts an explicit origin: %s",
    (origin) => {
      expect(
        getConsoleRuntimeConfig({ CONSOLE_AUTH_SECRET: secret, CONSOLE_ORIGIN: origin }).origin,
      ).toBe(origin);
    },
  );
  it("protects all HTTPS cookies without sharing the Web namespace", () => {
    for (const cookie of Object.values(getConsoleCookies("https://console.example.com"))) {
      expect(cookie.options).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure: true });
      expect(cookie.options).not.toHaveProperty("domain");
      expect(cookie.name).toMatch(/^oioi-console\./);
    }
  });
  it("uses distinct host-only cookies with HTTP-only SameSite protections", () => {
    for (const cookie of Object.values(getConsoleCookies("http://127.0.0.1:3001"))) {
      expect(cookie.name).toMatch(/^oioi-console\./);
      expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
      expect(cookie.options).not.toHaveProperty("domain");
    }
  });
});
