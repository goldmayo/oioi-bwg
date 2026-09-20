import * as Sentry from "@sentry/nextjs";

import { sanitizeServerSentryEvent } from "./src/server/observability/safe-server-event";
import { getSentryRuntimeConfig } from "./src/shared/config/sentry";

const config = getSentryRuntimeConfig();

/**
 * Node.js 서버 환경 전용 Sentry 초기화
 */
Sentry.init({
  dsn: config.dsn,
  enabled: config.enabled,
  environment: config.environment,
  sendDefaultPii: false,
  beforeSend: sanitizeServerSentryEvent,

  // error capture만 유지하고 tracing instrumentation은 비활성화한다.
  skipOpenTelemetrySetup: true,

  // 디버깅 모드
  debug: false,
});
