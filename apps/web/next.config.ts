import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

import { createNextConfig } from "@oioi-bwg/config/next";
import { createSentryBuildOptions } from "@oioi-bwg/config/sentry-build";
import { validateAppEnvironment } from "./src/shared/config/app-env";
import { getSentryBuildConfig } from "./src/shared/config/sentry-build";

validateAppEnvironment();

const nextConfig: NextConfig = createNextConfig(import.meta.dirname);

const sentryBuildConfig = getSentryBuildConfig();

export default sentryBuildConfig.enabled
  ? withSentryConfig(nextConfig, createSentryBuildOptions(sentryBuildConfig))
  : nextConfig;
