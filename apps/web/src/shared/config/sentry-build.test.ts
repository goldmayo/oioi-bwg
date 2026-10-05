import { describe, expect, it } from "vitest";

import { getSentryBuildConfig } from "./sentry-build";

const validEnvironment = {
  SENTRY_SOURCE_MAPS_ENABLED: "true",
  SENTRY_AUTH_TOKEN: "test-token",
  SENTRY_ORG: "oioi-bwg",
  SENTRY_PROJECT: "oioi-bwg",
  SENTRY_RELEASE: `oioi-bwg@${"a".repeat(40)}`,
};

describe("getSentryBuildConfig", () => {
  it("keeps local and ordinary verification builds disabled", () => {
    expect(getSentryBuildConfig({})).toEqual({ enabled: false });
    expect(
      getSentryBuildConfig({ ...validEnvironment, SENTRY_SOURCE_MAPS_ENABLED: "false" }),
    ).toEqual({ enabled: false });
  });

  it("returns the explicit CI source map configuration", () => {
    expect(getSentryBuildConfig(validEnvironment)).toEqual({
      enabled: true,
      authToken: "test-token",
      org: "oioi-bwg",
      project: "oioi-bwg",
      release: `oioi-bwg@${"a".repeat(40)}`,
    });
  });

  it.each(["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT", "SENTRY_RELEASE"] as const)(
    "fails the enabled build when %s is missing",
    (name) => {
      expect(() => getSentryBuildConfig({ ...validEnvironment, [name]: " " })).toThrow(name);
    },
  );

  it("rejects a release which cannot be correlated to the repository commit", () => {
    expect(() => getSentryBuildConfig({ ...validEnvironment, SENTRY_RELEASE: "latest" })).toThrow(
      "oioi-bwg@<40-character lowercase git SHA>",
    );
  });
});
