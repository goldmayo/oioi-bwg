import { authenticateConsoleMfa } from "@oioi-bwg/server/services/console-mfa-service";
import { afterEach, expect, it, vi } from "vitest";

import { authenticateConsole } from "./authenticate-console";

vi.mock("@oioi-bwg/server/services/console-mfa-service", () => ({
  authenticateConsoleMfa: vi.fn(),
}));
afterEach(() => vi.unstubAllEnvs());

it("passes a runtime key and all credentials to the atomic MFA service", async () => {
  const key = Buffer.alloc(32, 9);
  vi.stubEnv("CONSOLE_MFA_ENCRYPTION_KEY", key.toString("base64"));
  const identity = { id: "42", mfaVerified: true as const, mfaVersion: 7 };
  vi.mocked(authenticateConsoleMfa).mockResolvedValue(identity);
  expect(await authenticateConsole("admin@example.test", "password", "123456")).toEqual(identity);
  expect(authenticateConsoleMfa).toHaveBeenCalledWith(
    "admin@example.test",
    "password",
    "123456",
    key,
  );
  vi.mocked(authenticateConsoleMfa).mockResolvedValue(null);
  expect(await authenticateConsole("admin@example.test", "password", "123456")).toBeNull();
});

it("fails closed without a dedicated MFA key and does not fall back to an auth secret", async () => {
  vi.mocked(authenticateConsoleMfa).mockClear();
  vi.stubEnv("CONSOLE_MFA_ENCRYPTION_KEY", "");
  vi.stubEnv("CONSOLE_AUTH_SECRET", Buffer.alloc(32, 9).toString("base64"));
  await expect(authenticateConsole("admin@example.test", "password", "123456")).rejects.toThrow();
  expect(authenticateConsoleMfa).not.toHaveBeenCalled();
  vi.stubEnv("CONSOLE_MFA_ENCRYPTION_KEY", process.env.CONSOLE_AUTH_SECRET!);
  await expect(authenticateConsole("admin@example.test", "password", "123456")).rejects.toThrow();
});
