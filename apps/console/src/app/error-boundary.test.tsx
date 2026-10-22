import { StrictMode } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClientTransportError } from "@/shared/api/http-errors";
import { createQueryClient } from "@/shared/api/query/query-client";

import AdminError from "./(admin)/admin/error";
import GlobalError from "./global-error";

const capture = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/shared/lib/sentry", () => ({ captureClientException: capture }));

describe.each([
  ["admin-error-boundary", AdminError, "다시 시도"],
  ["global-error-boundary", GlobalError, "다시 시도하기"],
] as const)("%s mount observation", (source, Boundary, retryLabel) => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    document.querySelectorAll("iframe").forEach((frame) => frame.remove());
  });

  it("preserves the first mount after Query capture and suppresses StrictMode/rerender repeats", async () => {
    const error = Object.assign(new ClientTransportError("HTTP_ERROR", "private response", 502), {
      digest: "same-digest",
    });
    const client = createQueryClient();
    await expect(
      client.fetchQuery({
        queryKey: ["boundary-fixture"],
        retry: false,
        queryFn: () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);
    expect(capture).toHaveBeenCalledExactlyOnceWith(error, {
      source: "query-cache",
      outcome: "unknown",
    });

    const reset = vi.fn();
    const renderBoundary = (value: Error) => (
      <StrictMode>
        <Boundary error={value} reset={reset} />
      </StrictMode>
    );
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const view = render(renderBoundary(error), {
      container:
        source === "global-error-boundary" ? (frame.contentDocument ?? undefined) : undefined,
    });
    expect(capture).toHaveBeenLastCalledWith(error, {
      source,
      outcome: "error_boundary_mounted",
      digest: "same-digest",
    });
    view.rerender(renderBoundary(error));
    fireEvent.click(view.getByRole("button", { name: retryLabel }));
    expect(reset).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledTimes(2);

    const nextError = Object.assign(new Error("another request"), { digest: error.digest });
    view.rerender(renderBoundary(nextError));
    expect(capture).toHaveBeenCalledTimes(3);
    expect(capture).toHaveBeenLastCalledWith(nextError, {
      source,
      outcome: "error_boundary_mounted",
      digest: "same-digest",
    });
    client.clear();
  });
});
