const SENTRY_RELEASE_PATTERN = /^oioi-bwg@[0-9a-f]{40}$/;

interface BuildEnvironment {
  [key: string]: string | undefined;
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;
  SENTRY_PROJECT?: string;
  SENTRY_RELEASE?: string;
  SENTRY_SOURCE_MAPS_ENABLED?: string;
}

function readRequiredBuildValue(environment: BuildEnvironment, name: keyof BuildEnvironment) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing required Sentry build environment: ${name}`);
  return value;
}

/** Source map upload is an explicit CI build mode and never follows runtime Sentry activation. */
export function getSentryBuildConfig(environment: BuildEnvironment = process.env) {
  if (environment.SENTRY_SOURCE_MAPS_ENABLED !== "true") return { enabled: false } as const;

  const authToken = readRequiredBuildValue(environment, "SENTRY_AUTH_TOKEN");
  const org = readRequiredBuildValue(environment, "SENTRY_ORG");
  const project = readRequiredBuildValue(environment, "SENTRY_PROJECT");
  const release = readRequiredBuildValue(environment, "SENTRY_RELEASE");

  if (!SENTRY_RELEASE_PATTERN.test(release)) {
    throw new Error("SENTRY_RELEASE must use oioi-bwg@<40-character lowercase git SHA>");
  }

  return { enabled: true, authToken, org, project, release } as const;
}
