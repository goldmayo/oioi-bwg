import type { BrowserOptions } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";

const init = vi.hoisted(() => vi.fn<(options: BrowserOptions) => void>());
vi.mock("@sentry/nextjs", () => ({ init }));

describe("Console browser Sentry setup", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("leaves observation deduplication to error identity/source/outcome", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://fixture@example.test/1");
    await import("./instrumentation-client");
    const options = init.mock.calls[0]?.[0];
    const integrations = options?.integrations;
    if (typeof integrations !== "function") throw new Error("Expected integration selection");

    expect(
      integrations([
        { name: "Dedupe" },
        { name: "BrowserTracing" },
        { name: "Replay" },
        { name: "GlobalHandlers" },
      ]),
    ).toEqual([{ name: "GlobalHandlers" }]);
    const event = await options?.beforeSend?.(
      {
        type: undefined,
        tags: {
          source: "admin-error-boundary",
          outcome: "error_boundary_mounted",
        },
      },
      {},
    );
    expect(event?.tags).toMatchObject({ outcome: "error_boundary_mounted" });
  });
});
