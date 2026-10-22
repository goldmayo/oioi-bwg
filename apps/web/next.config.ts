import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

import { createNextConfig } from "../../config/next.ts";
import { createSentryBuildOptions } from "../../config/sentry-build.ts";
import { getSentryBuildConfig } from "./src/shared/config/sentry-build";

const nextConfig: NextConfig = createNextConfig(import.meta.dirname);

const sentryBuildConfig = getSentryBuildConfig();

export default sentryBuildConfig.enabled
  ? withSentryConfig(nextConfig, createSentryBuildOptions(sentryBuildConfig))
  : nextConfig;
