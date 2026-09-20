export const SENTRY_ENVIRONMENTS = ["staging", "production"] as const;

export type SentryEnvironment = (typeof SENTRY_ENVIRONMENTS)[number];

function isSentryEnvironment(value: string | undefined): value is SentryEnvironment {
  return SENTRY_ENVIRONMENTS.some((environment) => environment === value);
}

/** Sentry 전송 여부는 Next 실행 모드가 아니라 실제 배포 환경과 DSN으로 결정한다. */
export function getSentryRuntimeConfig() {
  const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  const environment = isSentryEnvironment(appEnvironment) ? appEnvironment : undefined;

  return {
    dsn,
    enabled: Boolean(environment && dsn),
    environment,
  };
}
