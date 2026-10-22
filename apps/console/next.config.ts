import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

import { createNextConfig } from "../../config/next.ts";
import { createSentryBuildOptions } from "../../config/sentry-build.ts";
import { validateAppEnvironment } from "./src/shared/config/app-env";
import { getSentryBuildConfig } from "./src/shared/config/sentry-build";

validateAppEnvironment();

const sharedNextConfig = createNextConfig(import.meta.dirname);
const nextConfig: NextConfig = {
  ...sharedNextConfig,
  experimental: {
    ...sharedNextConfig.experimental,
    authInterrupts: true,
  },
};

const sentryBuildConfig = getSentryBuildConfig();

export default sentryBuildConfig.enabled
  ? withSentryConfig(nextConfig, createSentryBuildOptions(sentryBuildConfig))
  : nextConfig;
