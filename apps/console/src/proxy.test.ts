import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";
import {
  INTERNAL_REQUEST_ID,
  INTERNAL_ROUTE_TEMPLATE,
  readRequestObservation,
} from "./shared/lib/observability-correlation";
const id = "48be30fa-1441-4dc9-8ffa-9b618ec32652";
describe("Console request observation ingress", () => {
  it("replaces caller IDs and forwards a fixed template without raw path/query", () => {
    const request = new NextRequest("http://localhost/admin/edit/private-slug?token=private", {
      headers: {
        "x-request-id": id,
        [INTERNAL_REQUEST_ID]: id,
        [INTERNAL_ROUTE_TEMPLATE]: "/admin/songs",
      },
    });
    const first = proxy(request);
    const second = proxy(request);
    expect(first.headers.get("x-request-id")).not.toBe(id);
    expect(first.headers.get("x-request-id")).not.toBe(second.headers.get("x-request-id"));
    expect(first.headers.get("x-middleware-request-" + INTERNAL_REQUEST_ID)).toBe(
      first.headers.get("x-request-id"),
    );
    expect(first.headers.get("x-middleware-request-" + INTERNAL_ROUTE_TEMPLATE)).toBe(
      "/admin/edit/[slug]",
    );
  });
  it.each([
    "/admin",
    "/admin/albums",
    "/api/admin/songs/42",
    "/api/auth/session",
    "/api/operator/auth/device",
    "/operator-connect",
    "/admin-login",
  ])("matches %s", (url) => expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true));
  it.each(["/healthz", "/readyz", "/_next/static/test.js", "/administrator", "/favicon.ico"])(
    "excludes %s",
    (url) => expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false),
  );
  it("accepts only verified IDs on the expected owned route", () => {
    expect(
      readRequestObservation(
        new Headers({ [INTERNAL_REQUEST_ID]: id, [INTERNAL_ROUTE_TEMPLATE]: "/admin/edit/[slug]" }),
        "/admin/edit/[slug]",
      ),
    ).toEqual({ requestId: id, route: "/admin/edit/[slug]" });
    expect(
      readRequestObservation({
        [INTERNAL_REQUEST_ID]: "private",
        [INTERNAL_ROUTE_TEMPLATE]: "/admin",
      }),
    ).toEqual({});
    expect(
      readRequestObservation(
        { [INTERNAL_REQUEST_ID]: id, [INTERNAL_ROUTE_TEMPLATE]: "/admin" },
        "/admin/songs",
      ),
    ).toEqual({});
    expect(
      readRequestObservation({
        get get() {
          throw new Error("private");
        },
      }),
    ).toEqual({});
  });
});
