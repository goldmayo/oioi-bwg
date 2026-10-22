import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureClientErrorOnce } from "./capture-client-error";

const capture = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/shared/lib/sentry", () => ({ captureClientException: capture }));

describe("client observation deduplication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps separate producers and outcomes for one error, in either order", () => {
    const error = new Error("same error");
    const contexts = [
      { source: "admin-error-boundary", outcome: "error_boundary_mounted" },
      { source: "query-cache" },
      { source: "mutation-cache" },
      { source: "global-error-boundary", outcome: "error_boundary_mounted" },
      { source: "admin-error-boundary" },
    ] as const;
    for (const context of [...contexts, ...contexts.toReversed()]) {
      captureClientErrorOnce(error, context);
    }
    expect(capture).toHaveBeenCalledTimes(contexts.length);
  });

  it("does not merge different errors with the same digest or collapse primitive failures", () => {
    for (const error of [new Error("a"), new Error("b"), "unknown", "unknown"]) {
      captureClientErrorOnce(error, {
        source: "admin-error-boundary",
        outcome: "error_boundary_mounted",
        digest: "same-digest",
      });
    }
    expect(capture).toHaveBeenCalledTimes(4);
  });
});
