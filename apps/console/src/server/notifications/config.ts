import "server-only";

import { pushConfigSchema } from "@oioi-bwg/contracts/notification";
import { z } from "zod";

export function getPushConfig() {
  if (process.env.CONSOLE_PUSH_ENABLED !== "true") return null;
  const result = pushConfigSchema.safeParse({
    apiKey: process.env.FIREBASE_API_KEY,
    appId: process.env.FIREBASE_APP_ID,
    projectId: process.env.FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    vapidKey: process.env.FIREBASE_VAPID_PUBLIC_KEY,
  });
  if (!result.success) throw new Error("Invalid Console push configuration");
  return result.data;
}
export function getPushCredentials(projectId: string) {
  try {
    const value: unknown = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "");
    const credentials = z
      .object({ project_id: z.string(), client_email: z.email(), private_key: z.string().min(1) })
      .parse(value);
    if (credentials.project_id !== projectId) throw new Error();
    return credentials;
  } catch {
    throw new Error("Invalid Console push credentials");
  }
}
