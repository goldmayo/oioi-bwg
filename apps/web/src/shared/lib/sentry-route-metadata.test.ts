import { describe, expect, it } from "vitest";

import { sanitizeServerSentryEvent } from "@/server/observability/safe-server-event";

import { sanitizeClientBreadcrumb, sanitizeClientSentryEvent } from "./client-sentry-policy";
import { getSentryRouteMetadata } from "./sentry-route-metadata";

describe("Web route metadata privacy", () => {
  it.each([
    ["/", "/", "web-home"],
    ["/(user)/songs/private-email@example.test?token=TOKEN", "/songs/[slug]", "public-song-detail"],
    ["/api/songs/private-id", "/api/songs/[slug]", "public-song-api"],
    ["/api/albums/private", "/api/albums/[slug]", "public-album-api"],
  ])("maps %s to an owned template", (path, template, operation) => {
    expect(getSentryRouteMetadata(path)).toEqual({ template, operation });
  });
  it.each([
    "/private/TOKEN",
    "/admin",
    "/api/auth/session",
    "/healthz",
    "/administrator/albums",
    "javascript:secret",
    "constructor",
    "https://[",
    undefined,
  ])("omits unknown paths %s", (path) => {
    expect(getSentryRouteMetadata(path)).toBeUndefined();
  });
  it("preserves producer metadata through both final allowlists", () => {
    const tags = { "route.template": "/songs/private-email@example.test?token=TOKEN" };
    for (const [event, runtime] of [
      [sanitizeClientSentryEvent({ type: undefined, tags }), "browser"],
      [sanitizeServerSentryEvent({ type: undefined, tags }), "node"],
    ] as const) {
      expect(event.tags).toMatchObject({
        app: "web",
        runtime,
        "route.template": "/songs/[slug]",
        operation: "public-song-detail",
      });
      expect(JSON.stringify(event)).not.toMatch(/private-email|TOKEN/);
    }
    expect(
      sanitizeClientBreadcrumb({
        category: "navigation",
        data: { from: "/songs/private?token=TOKEN", to: "/unknown/TOKEN" },
      })?.data,
    ).toEqual({ from: "/songs/[slug]" });
  });
});
