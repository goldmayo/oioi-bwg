import { describe, expect, it } from "vitest";

import { sanitizeServerSentryEvent } from "@/server/observability/safe-server-event";

import { sanitizeClientBreadcrumb, sanitizeClientSentryEvent } from "./client-sentry-policy";
import { getSentryRouteMetadata } from "./sentry-route-metadata";

describe("Console route metadata privacy", () => {
  it.each([
    ["/admin/albums", "/admin/albums", "admin-album-list"],
    [
      "/(admin)/admin/edit/private-email@example.test?token=TOKEN",
      "/admin/edit/[slug]",
      "admin-song-edit-load",
    ],
    ["/api/admin/songs/private-id/lyrics", "/api/admin/songs/[id]/lyrics", "admin-song-lyrics-api"],
    ["/api/auth/callback/credentials", "/api/auth/[...nextauth]", "admin-auth"],
  ])("maps %s to an owned template", (path, template, operation) => {
    expect(getSentryRouteMetadata(path)).toEqual({ template, operation });
  });
  it.each([
    "/private/TOKEN",
    "/administrator/albums",
    "javascript:secret",
    "constructor",
    "https://[",
    undefined,
  ])("omits unknown paths %s", (path) => {
    expect(getSentryRouteMetadata(path)).toBeUndefined();
  });
  it("preserves producer metadata through both final allowlists", () => {
    const tags = { "route.template": "/admin/edit/private-email@example.test?token=TOKEN" };
    for (const [event, runtime] of [
      [sanitizeClientSentryEvent({ type: undefined, tags }), "browser"],
      [sanitizeServerSentryEvent({ type: undefined, tags }), "node"],
    ] as const) {
      expect(event.tags).toMatchObject({
        app: "console",
        runtime,
        "route.template": "/admin/edit/[slug]",
        operation: "admin-song-edit-load",
      });
      expect(JSON.stringify(event)).not.toMatch(/private-email|TOKEN/);
    }
    expect(
      sanitizeClientBreadcrumb({
        category: "navigation",
        data: { from: "/admin/edit/private?token=TOKEN", to: "/unknown/TOKEN" },
      })?.data,
    ).toEqual({ from: "/admin/edit/[slug]" });
  });
});
