import { afterEach, describe, expect, it, vi } from "vitest";

const submitEmail = vi.hoisted(() => vi.fn());

vi.mock("oci-sdk", () => ({
  common: {
    InstancePrincipalsAuthenticationDetailsProviderBuilder: class {
      build() {
        return Promise.resolve({});
      }
    },
    OciError: class extends Error {},
  },
  emaildataplane: {
    EmailDPClient: class {
      regionId = "";
      submitEmail = submitEmail;
    },
  },
}));

import { sendEmail } from "./oci-email-delivery";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("sendEmail", () => {
  it.each(["development", "test", "production"] as const)(
    "keeps local email no-send with NODE_ENV=%s",
    async (nodeEnvironment) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
      vi.stubEnv("NODE_ENV", nodeEnvironment);
      for (const mode of [undefined, "dev"]) {
        vi.stubEnv("EMAIL_DELIVERY_MODE", mode);

        await expect(
          sendEmail({ to: "user@example.com", subject: "test", text: "test" }),
        ).resolves.toEqual({
          mode: "dev",
          messageId: null,
          envelopeId: null,
          suppressedRecipients: [],
          opcRequestId: null,
        });
      }
      expect(submitEmail).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "oci"])("separates OCI identifiers with production mode %s", async (mode) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_DELIVERY_MODE", mode);
    vi.stubEnv("OCI_EMAIL_COMPARTMENT_OCID", "ocid1.compartment.test");
    vi.stubEnv("OCI_EMAIL_SENDER_ADDRESS", "no-reply@example.com");
    vi.stubEnv("OCI_EMAIL_REGION", "ap-osaka-1");
    submitEmail.mockResolvedValueOnce({
      opcRequestId: "opc-request-id",
      emailSubmittedResponse: {
        messageId: "message-id@example.com",
        envelopeId: "envelope-id",
        suppressedRecipients: [{ email: "suppressed@example.com" }],
      },
    });

    await expect(
      sendEmail({ to: "user@example.com", subject: "test", text: "test" }),
    ).resolves.toEqual({
      mode: "oci",
      messageId: "message-id@example.com",
      envelopeId: "envelope-id",
      suppressedRecipients: ["suppressed@example.com"],
      opcRequestId: "opc-request-id",
    });
  });

  it.each(["development", "test", "production"] as const)(
    "rejects production dev delivery with NODE_ENV=%s",
    async (nodeEnvironment) => {
      vi.stubEnv("EMAIL_DELIVERY_MODE", "dev");
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
      vi.stubEnv("NODE_ENV", nodeEnvironment);

      await expect(
        sendEmail({ to: "user@example.com", subject: "test", text: "test" }),
      ).rejects.toThrow("dev email delivery is not allowed in production");
      expect(submitEmail).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "", "staging", "development"])(
    "rejects unsupported environment %s before OCI",
    async (environment) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", environment);
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("EMAIL_DELIVERY_MODE", "oci");
      await expect(
        sendEmail({ to: "user@example.com", subject: "test", text: "test" }),
      ).rejects.toThrow("NEXT_PUBLIC_APP_ENV must be local or production.");
      expect(submitEmail).not.toHaveBeenCalled();
    },
  );
});
