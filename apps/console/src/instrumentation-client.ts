import * as Sentry from "@sentry/nextjs";

import { getSentryRuntimeConfig } from "@/shared/config/sentry";
import {
  sanitizeClientBreadcrumb,
  sanitizeClientSentryEvent,
} from "@/shared/lib/client-sentry-policy";

const config = getSentryRuntimeConfig();
// Dedupe는 source/outcome과 Error identity를 비교하지 않아 서로 다른 관측을 잃게 한다.
// 명시적 보고는 captureClientErrorOnce가 객체·source·outcome별로 중복을 제한한다.
const DISABLED_INTEGRATIONS = new Set(["BrowserTracing", "Replay", "Dedupe"]);

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
