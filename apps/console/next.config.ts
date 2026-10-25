import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

import { createNextConfig } from "@oioi-bwg/config/next";
import { createSentryBuildOptions } from "@oioi-bwg/config/sentry-build";
import { validateAppEnvironment } from "./src/shared/config/app-env";
import { getSentryBuildConfig } from "./src/shared/config/sentry-build";

validateAppEnvironment();

const sharedNextConfig = createNextConfig(import.meta.dirname);
const nextConfig: NextConfig = {
  ...sharedNextConfig,
  transpilePackages: [...(sharedNextConfig.transpilePackages ?? []), "@oioi-bwg/ui"],
  experimental: {
    ...sharedNextConfig.experimental,
    authInterrupts: true,
  },
};

const sentryBuildConfig = getSentryBuildConfig();

export default sentryBuildConfig.enabled
  ? withSentryConfig(nextConfig, createSentryBuildOptions(sentryBuildConfig))
  : nextConfig;
