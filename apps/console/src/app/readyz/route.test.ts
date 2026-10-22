import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@oioi-bwg/server/db", () => ({ getDatabase: () => ({ execute }) }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor() {
      throw new Error("Readiness must not create an R2 client");
    }
  },
  PutObjectCommand: class {},
}));

import { GET } from "./route";

describe("Console readiness", () => {
  beforeEach(() => {
    execute.mockReset().mockResolvedValue([]);
    vi.stubEnv("CONSOLE_ORIGIN", "http://127.0.0.1:3001");
    vi.stubEnv("CONSOLE_AUTH_SECRET", "console-readiness-test-only-secret");
    vi.stubEnv("AUTH_SECRET", "different-web-readiness-test-only-secret");
    vi.stubEnv("CONSOLE_MFA_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
    vi.stubEnv("R2_ENDPOINT", "https://r2.example.test");
    vi.stubEnv("R2_BUCKET", "readiness-test");
    vi.stubEnv("R2_ACCESS_KEY_ID", "readiness-test-access");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "readiness-test-secret");
    vi.stubEnv("ASSETS_PUBLIC_BASE_URL", "https://assets.example.test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns uncached readiness after checking PostgreSQL", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ready" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it.each<[string, string | undefined]>([
    ["CONSOLE_AUTH_SECRET", ""],
    ["CONSOLE_AUTH_SECRET", "different-web-readiness-test-only-secret"],
    ["CONSOLE_MFA_ENCRYPTION_KEY", ""],
    ["CONSOLE_MFA_ENCRYPTION_KEY", "invalid-key"],
    ["CONSOLE_ORIGIN", "http://console.example.test"],
    ...[
      "R2_ENDPOINT",
      "R2_BUCKET",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "ASSETS_PUBLIC_BASE_URL",
    ].flatMap((name) =>
      [undefined, "", "   "].map<[string, string | undefined]>((value) => [name, value]),
    ),
    ...["R2_ENDPOINT", "ASSETS_PUBLIC_BASE_URL"].flatMap((name) =>
      [
        "invalid-private-url",
        "http://assets.example.test",
        "https://user:private@example.test",
        "https://example.test/?private=value",
        "https://example.test/#private",
        "https://example.test/?",
        "https://example.test/#",
        "https://example.test/?#",
      ].map<[string, string]>((value) => [name, value]),
    ),
  ])("rejects unusable %s without accessing PostgreSQL", async (name, value) => {
    vi.stubEnv(name, value);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
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
