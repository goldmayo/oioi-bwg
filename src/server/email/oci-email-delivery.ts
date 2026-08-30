import "server-only";

import * as oci from "oci-sdk";

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

type EmailDeliveryResult = { messageId: string | null; mode: "dev" | "oci" };

let clientPromise: Promise<oci.emaildataplane.EmailDPClient> | undefined;

async function getClient() {
  if (!clientPromise) {
    clientPromise = new oci.common.InstancePrincipalsAuthenticationDetailsProviderBuilder()
      .build()
      .then((authenticationDetailsProvider) => {
        const client = new oci.emaildataplane.EmailDPClient({ authenticationDetailsProvider });
        const region = process.env.OCI_EMAIL_REGION;
        if (region) client.regionId = region;
        return client;
      });
  }
  return clientPromise!;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for OCI email delivery`);
  return value;
}

export async function sendEmail(email: OutboundEmail): Promise<EmailDeliveryResult> {
  const mode =
    process.env.EMAIL_DELIVERY_MODE ?? (process.env.NODE_ENV === "production" ? "oci" : "dev");
  if (mode === "dev") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("dev email delivery is not allowed in production");
    }
    return { messageId: null, mode };
  }
  if (mode !== "oci") throw new Error("EMAIL_DELIVERY_MODE must be dev or oci");

  const client = await getClient();
  const response = await client.submitEmail({
    submitEmailDetails: {
      sender: {
        compartmentId: required("OCI_EMAIL_COMPARTMENT_OCID"),
        senderAddress: {
          email: required("OCI_EMAIL_SENDER_ADDRESS"),
          name: process.env.OCI_EMAIL_SENDER_NAME,
        },
      },
      recipients: { to: [{ email: email.to }] },
      subject: email.subject,
      bodyText: email.text,
      bodyHtml: email.html,
    },
  });

  return { messageId: response.opcRequestId ?? null, mode };
}
