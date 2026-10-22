import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";
import {
  INTERNAL_REQUEST_ID,
  INTERNAL_ROUTE_TEMPLATE,
  readRequestObservation,
} from "./shared/lib/sentry/correlation";
const id = "48be30fa-1441-4dc9-8ffa-9b618ec32652";
describe("Web request observation ingress", () => {
  it("replaces caller IDs and forwards a fixed template without raw path/query", () => {
    const request = new NextRequest("http://localhost/songs/private-slug?token=private", {
      headers: {
        "x-request-id": id,
        [INTERNAL_REQUEST_ID]: id,
        [INTERNAL_ROUTE_TEMPLATE]: "/api/songs/[slug]",
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
      "/songs/[slug]",
    );
  });
  it.each(["/", "/albums/example", "/api/songs/example", "/api/albums/example", "/chants"])(
    "matches %s",
    (url) => expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true),
  );
  it.each([
    "/healthz",
    "/readyz",
    "/_next/static/test.js",
    "/api/auth/session",
    "/more",
    "/more/policy/privacy",
    "/admin",
    "/favicon.ico",
  ])("excludes %s", (url) => expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false));
  it("accepts only verified IDs on the expected owned route", () => {
    expect(
      readRequestObservation(
        new Headers({ [INTERNAL_REQUEST_ID]: id, [INTERNAL_ROUTE_TEMPLATE]: "/songs/[slug]" }),
        "/songs/[slug]",
      ),
    ).toEqual({ requestId: id, route: "/songs/[slug]" });
    expect(
      readRequestObservation({
        [INTERNAL_REQUEST_ID]: "private",
        [INTERNAL_ROUTE_TEMPLATE]: "/",
      }),
    ).toEqual({});
    expect(
      readRequestObservation(
        { [INTERNAL_REQUEST_ID]: id, [INTERNAL_ROUTE_TEMPLATE]: "/" },
        "/api/songs/[slug]",
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

it("rejects caller correlation on static and retired routes", () => {
  for (const route of ["/more", "/more/policy/[slug]", "/api/auth/session", "/healthz"]) {
    expect(
      readRequestObservation(
        new Headers({ [INTERNAL_REQUEST_ID]: id, [INTERNAL_ROUTE_TEMPLATE]: route }),
      ),
    ).toEqual({});
  }
});
