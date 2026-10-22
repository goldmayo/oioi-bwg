interface SentryBuildInput {
  authToken: string;
  org: string;
  project: string;
  release: string;
}

/** App entries validate their environment and pass these options to their own SDK. */
export function createSentryBuildOptions(config: SentryBuildInput) {
  return {
    authToken: config.authToken,
    org: config.org,
    project: config.project,
    telemetry: false,
    routeManifestInjection: false as const,
    suppressOnRouterTransitionStartWarning: true,
    errorHandler(error: Error) {
      throw error;
    },
    release: {
      name: config.release,
      create: true,
      finalize: true,
    },
    sourcemaps: {
      filesToDeleteAfterUpload: [".next/**/*.map"],
    },
  };
}
