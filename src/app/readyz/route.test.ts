import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ getDatabase: () => ({ execute }) }));

import { GET } from "./route";

describe("GET /readyz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports readiness after PostgreSQL responds", async () => {
    execute.mockResolvedValueOnce([]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ready" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("returns a detail-free unavailable response when PostgreSQL fails", async () => {
    execute.mockRejectedValueOnce(new Error("contains-sensitive-connection-detail"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
