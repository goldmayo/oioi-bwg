import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /healthz", () => {
  it("reports process and HTTP liveness without caching", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
