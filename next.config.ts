import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

import { getSentryBuildConfig } from "./src/shared/config/sentry-build";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.oioibawige.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  serverExternalPackages: ["postgres"],
};

const sentryBuildConfig = getSentryBuildConfig();

export default sentryBuildConfig.enabled
  ? withSentryConfig(nextConfig, {
      authToken: sentryBuildConfig.authToken,
      org: sentryBuildConfig.org,
      project: sentryBuildConfig.project,
      telemetry: false,
      routeManifestInjection: false,
      suppressOnRouterTransitionStartWarning: true,
      errorHandler(error) {
        throw error;
      },
      release: {
        name: sentryBuildConfig.release,
        create: true,
        finalize: true,
      },
      sourcemaps: {
        filesToDeleteAfterUpload: [".next/**/*.map"],
      },
    })
  : nextConfig;
