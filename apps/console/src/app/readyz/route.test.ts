import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@oioi-bwg/server/db", () => ({ getDatabase: () => ({ execute }) }));

import { GET } from "./route";

describe("Console readiness", () => {
  beforeEach(() => {
    execute.mockReset().mockResolvedValue([]);
    vi.stubEnv("CONSOLE_ORIGIN", "http://127.0.0.1:3001");
    vi.stubEnv("CONSOLE_AUTH_SECRET", "console-readiness-test-only-secret");
    vi.stubEnv("AUTH_SECRET", "different-web-readiness-test-only-secret");
    vi.stubEnv("CONSOLE_MFA_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns uncached readiness after checking PostgreSQL", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ready" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it.each([
    ["CONSOLE_AUTH_SECRET", ""],
    ["CONSOLE_AUTH_SECRET", "different-web-readiness-test-only-secret"],
    ["CONSOLE_MFA_ENCRYPTION_KEY", ""],
    ["CONSOLE_MFA_ENCRYPTION_KEY", "invalid-key"],
    ["CONSOLE_ORIGIN", "https://console.example.test"],
  ])("rejects unusable %s without accessing PostgreSQL", async (name, value) => {
    vi.stubEnv(name, value);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("conceals database errors and does not cache failure", async () => {
    execute.mockRejectedValue(new Error("postgres://private-connection-test-only"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
