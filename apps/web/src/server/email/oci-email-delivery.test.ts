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
});

describe("sendEmail", () => {
  it("uses a no-send dev path outside production", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "dev");
    vi.stubEnv("NODE_ENV", "test");

    await expect(
      sendEmail({ to: "user@example.com", subject: "test", text: "test" }),
    ).resolves.toEqual({
      mode: "dev",
      messageId: null,
      envelopeId: null,
      suppressedRecipients: [],
      opcRequestId: null,
    });
  });

  it("separates OCI message, envelope, suppression, and request identifiers", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "oci");
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

  it("rejects the dev path in production", async () => {
    vi.stubEnv("EMAIL_DELIVERY_MODE", "dev");
    vi.stubEnv("NODE_ENV", "production");

    await expect(
      sendEmail({ to: "user@example.com", subject: "test", text: "test" }),
    ).rejects.toThrow("dev email delivery is not allowed in production");
  });
});
