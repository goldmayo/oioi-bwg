import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { toSafeSentryBuildMetadata, toSafeSentryBuildPath } from "./sentry-build-metadata";

const release = `oioi-bwg@${"a".repeat(40)}`;
const debugId = "12345678-1234-4abc-8def-1234567890ab";

describe("Sentry build metadata privacy policy", () => {
  it("normalizes client and server artifact paths without retaining hosts or container roots", () => {
    expect(
      toSafeSentryBuildPath("https://staging.example.test/_next/static/chunks/app.js?token=secret"),
    ).toBe("/_next/static/chunks/app.js");
    expect(toSafeSentryBuildPath("file:///app/.next/server/chunks/app.js")).toBe(
      ".next/server/chunks/app.js",
    );
    expect(toSafeSentryBuildPath("/private/user@example.test/file.js")).toBeUndefined();
  });

  it("keeps only the release and sourcemap debug images", () => {
    expect(
      toSafeSentryBuildMetadata({
        release,
        debug_meta: {
          images: [
            {
              type: "sourcemap",
              code_file: "https://staging.example.test/_next/static/chunks/app.js?private=1",
              debug_id: debugId,
            },
            {
              type: "wasm",
              code_file: "/private/secret.wasm",
              debug_id: debugId,
            },
          ],
        },
      } as ErrorEvent),
    ).toEqual({
      release,
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            code_file: "/_next/static/chunks/app.js",
            debug_id: debugId,
          },
        ],
      },
    });
  });

  it("drops untrusted release and debug metadata", () => {
    const marker = "SECRET_MARKER";
    const output = toSafeSentryBuildMetadata({
      release: `latest-${marker}`,
      dist: marker,
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            code_file: `/private/${marker}.js`,
            debug_id: marker,
          },
        ],
      },
    } as ErrorEvent);

    expect(output).toEqual({});
    expect(JSON.stringify(output)).not.toContain(marker);
  });
});
