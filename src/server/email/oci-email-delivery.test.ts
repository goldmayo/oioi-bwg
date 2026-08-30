import { afterEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "./oci-email-delivery";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendEmail", () => {
  it("uses a no-send dev path outside production", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "dev");
    vi.stubEnv("NODE_ENV", "test");

    await expect(
      sendEmail({ to: "user@example.com", subject: "test", text: "test" }),
    ).resolves.toEqual({ messageId: null, mode: "dev" });
  });

  it("rejects the dev path in production", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "dev");
    vi.stubEnv("NODE_ENV", "production");

    await expect(
      sendEmail({ to: "user@example.com", subject: "test", text: "test" }),
    ).rejects.toThrow("dev email delivery is not allowed in production");
  });
});
