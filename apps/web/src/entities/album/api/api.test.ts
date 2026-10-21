import { expect, test, vi } from "vitest";
const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/shared/api/http-client", () => ({ http }));
import { getAlbumDetail } from "./api";
import { albumQueries } from "./queries";
import { albumQueryKeys } from "./query-keys";

test("public album requests keep the encoded slug, cancellation and query identity", async () => {
  const signal = new AbortController().signal;
  http.get.mockResolvedValue({ invalid: true });
  await expect(getAlbumDetail("space / slug", signal)).rejects.toThrow(
    "API response contract violation",
  );
  expect(http.get).toHaveBeenCalledWith("/api/albums/space%20%2F%20slug", { signal });
  expect(albumQueries.detail("fixture").queryKey).toEqual(albumQueryKeys.detail("fixture"));
});
