import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("http client", () => {
  it("accepts empty 204 DELETE and POST responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { http } = await import("./http-client");

    await expect(http.delete("https://example.test/admin/albums/1")).resolves.toBeUndefined();
    await expect(
      http.postVoid("https://example.test/admin/notifications/read-all"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
