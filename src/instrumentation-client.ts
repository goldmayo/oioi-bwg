import * as Sentry from "@sentry/nextjs";

import { getSentryRuntimeConfig } from "@/shared/config/sentry";
import {
  sanitizeClientBreadcrumb,
  sanitizeClientSentryEvent,
} from "@/shared/lib/client-sentry-policy";

const config = getSentryRuntimeConfig();
const DISABLED_INTEGRATIONS = new Set(["BrowserTracing", "Replay"]);

if (config.enabled) {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    sendDefaultPii: false,
    beforeSend: sanitizeClientSentryEvent,
    beforeBreadcrumb: sanitizeClientBreadcrumb,

    // 현재 범위는 error monitoring뿐이다. tracing integration과 Replay는 명시적으로 제외한다.
    integrations: (defaultIntegrations) =>
      defaultIntegrations.filter((integration) => !DISABLED_INTEGRATIONS.has(integration.name)),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    debug: false,
  });
}
