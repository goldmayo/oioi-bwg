import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import {
  describeClientError,
  sanitizeClientBreadcrumb,
  sanitizeClientSentryEvent,
  toSafeSentryErrorContext,
} from "./client-sentry-policy";

const MARKERS = {
  auth: "AUTHORIZATION_MARKER",
  email: "private-email@example.test",
  query: "QUERY_SECRET_MARKER",
  token: "TOKEN_MARKER",
  zod: "ZOD_INPUT_MARKER",
};

function serialized(value: unknown) {
  return JSON.stringify(value);
}

describe("client Sentry privacy policy", () => {
  it("normalizes capture context to the source and a bounded digest", () => {
    expect(
      toSafeSentryErrorContext({
        source: "admin-error-boundary",
        digest: "safe_digest-123",
        token: MARKERS.token,
      }),
    ).toEqual({ source: "admin-error-boundary", digest: "safe_digest-123" });

    expect(
      toSafeSentryErrorContext({
        source: "UNSAFE_SOURCE",
        digest: `unsafe?${MARKERS.query}`,
      }),
    ).toEqual({ source: "sentry-auto-capture" });
  });

  it("classifies client boundary errors without reading their cause", () => {
    expect(describeClientError({ name: "ClientContractError", cause: MARKERS.zod })).toBe(
      "client-contract",
    );
    expect(describeClientError({ name: "ClientTransportError", cause: MARKERS.auth })).toBe(
      "client-transport",
    );
    expect(describeClientError(new TypeError(MARKERS.token))).toBe("runtime");
  });

  it("keeps only query-free navigation breadcrumbs", () => {
    expect(
      sanitizeClientBreadcrumb({
        category: "navigation",
        message: MARKERS.token,
        data: {
          from: `/admin?email=${MARKERS.email}`,
          to: `/songs#${MARKERS.query}`,
        },
      }),
    ).toEqual({
      category: "navigation",
      type: "navigation",
      level: "info",
      data: { from: "/admin", to: "/songs" },
    });

    expect(
      sanitizeClientBreadcrumb({
        category: "fetch",
        data: { url: `/api/private?token=${MARKERS.token}` },
      }),
    ).toBeNull();
  });

  it.each([
    [
      "TypeError",
      "Cannot read properties of undefined (reading 'map')",
      "Cannot read properties of undefined (reading 'map')",
    ],
    ["TypeError", "Failed to fetch", "Failed to fetch"],
    ["ReferenceError", "album is not defined", "Identifier is not defined"],
    ["RangeError", "Maximum call stack size exceeded", "Maximum call stack size exceeded"],
  ])("keeps a safe %s engine diagnostic", (type, value, expected) => {
    const safeEvent = sanitizeClientSentryEvent({
      exception: { values: [{ type, value }] },
    } as unknown as ErrorEvent);

    expect(safeEvent.exception?.values?.[0]?.value).toBe(expected);
  });

  it("redacts free-form runtime messages and dynamic property names", () => {
    const freeForm = sanitizeClientSentryEvent({
      exception: { values: [{ type: "TypeError", value: MARKERS.token }] },
    } as unknown as ErrorEvent);
    const dynamicProperty = sanitizeClientSentryEvent({
      exception: {
        values: [
          {
            type: "TypeError",
            value: `Cannot read properties of undefined (reading '${MARKERS.token}')`,
          },
        ],
      },
    } as unknown as ErrorEvent);
    const dynamicIdentifier = sanitizeClientSentryEvent({
      exception: {
        values: [{ type: "ReferenceError", value: `${MARKERS.token} is not defined` }],
      },
    } as unknown as ErrorEvent);

    expect(freeForm.exception?.values?.[0]?.value).toBe("Unexpected client error");
    expect(dynamicProperty.exception?.values?.[0]?.value).toBe(
      "Cannot read properties of undefined (reading a property)",
    );
    expect(dynamicIdentifier.exception?.values?.[0]?.value).toBe("Identifier is not defined");
    expect(serialized([freeForm, dynamicProperty, dynamicIdentifier])).not.toContain(MARKERS.token);
  });

  it.each([
    ["ClientContractError", "client-contract", "Client response contract violation"],
    ["ClientTransportError", "client-transport", "Client transport error"],
  ])("uses a diagnostic category for %s", (type, errorType, expected) => {
    const safeEvent = sanitizeClientSentryEvent({
      exception: { values: [{ type, value: MARKERS.zod }] },
      tags: { "error.type": errorType },
    } as unknown as ErrorEvent);

    expect(safeEvent.exception?.values?.[0]?.value).toBe(expected);
    expect(serialized(safeEvent)).not.toContain(MARKERS.zod);
  });

  it("drops URL details, raw errors, causes, user data and network metadata", () => {
    const event = {
      type: undefined,
      event_id: "a".repeat(32),
      timestamp: 123,
      environment: "staging",
      message: MARKERS.token,
      logentry: { message: MARKERS.auth, params: [MARKERS.zod] },
      exception: {
        values: [
          {
            type: "ZodError",
            value: MARKERS.zod,
            stacktrace: { frames: [{ filename: `/cause?input=${MARKERS.zod}` }] },
          },
          {
            type: "ClientContractError",
            value: `${MARKERS.email} ${MARKERS.query}`,
            mechanism: { data: { cause: MARKERS.zod } },
            stacktrace: {
              frames: [
                {
                  filename: `https://example.test/_next/chunk.js?token=${MARKERS.token}`,
                  function: "parseClientResponse",
                  lineno: 42,
                  colno: 9,
                  context_line: MARKERS.email,
                  vars: { authorization: MARKERS.auth },
                },
              ],
            },
          },
        ],
      },
      request: {
        url: `https://example.test/admin?token=${MARKERS.token}`,
        headers: { authorization: MARKERS.auth },
      },
      user: { email: MARKERS.email },
      extra: { zod: MARKERS.zod },
      tags: {
        source: "query-cache",
        "error.type": "client-contract",
        "error.digest": "safe-digest_123",
        unsafe: MARKERS.token,
      },
      contexts: {
        browser: { name: "Chrome", version: "140", unsafe: MARKERS.token },
        os: { name: "Linux", version: "6", unsafe: MARKERS.auth },
        response: { body: MARKERS.zod },
      },
      breadcrumbs: [
        { category: "fetch", data: { url: `/api?token=${MARKERS.token}` } },
        {
          category: "navigation",
          message: MARKERS.auth,
          data: { from: `/login?email=${MARKERS.email}`, to: "/admin#private" },
        },
      ],
    } as unknown as ErrorEvent;

    const safeEvent = sanitizeClientSentryEvent(event);
    const output = serialized(safeEvent);

    for (const marker of Object.values(MARKERS)) expect(output).not.toContain(marker);
    expect(safeEvent).toEqual({
      type: undefined,
      event_id: "a".repeat(32),
      timestamp: 123,
      level: "error",
      platform: "javascript",
      environment: "staging",
      exception: {
        values: [
          {
            type: "ClientContractError",
            value: "Client response contract violation",
            stacktrace: {
              frames: [
                {
                  filename: "/_next/chunk.js",
                  function: "parseClientResponse",
                  lineno: 42,
                  colno: 9,
                },
              ],
            },
          },
        ],
      },
      tags: {
        source: "query-cache",
        "error.type": "client-contract",
        "error.digest": "safe-digest_123",
      },
      contexts: {
        browser: { name: "Chrome", version: "140" },
        os: { name: "Linux", version: "6" },
      },
      breadcrumbs: [
        {
          category: "navigation",
          type: "navigation",
          level: "info",
          data: { from: "/login", to: "/admin" },
        },
      ],
    });
  });
});
