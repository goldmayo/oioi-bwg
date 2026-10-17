import { describe, expect, it } from "vitest";

import { consoleCookies, getConsoleRuntimeConfig } from "./console-runtime";

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
    "https://console.example.com",
    "http://example.com",
    "http://localhost.evil.test",
    "http://user@localhost",
    "http://localhost/admin",
  ])("rejects a public or ambiguous P04 origin: %s", (origin) => {
    expect(() =>
      getConsoleRuntimeConfig({ CONSOLE_AUTH_SECRET: secret, CONSOLE_ORIGIN: origin }),
    ).toThrow();
  });
  it("uses distinct host-only cookies with HTTP-only SameSite protections", () => {
    for (const cookie of Object.values(consoleCookies)) {
      expect(cookie.name).toMatch(/^oioi-console\./);
      expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
      expect(cookie.options).not.toHaveProperty("domain");
    }
  });
});
