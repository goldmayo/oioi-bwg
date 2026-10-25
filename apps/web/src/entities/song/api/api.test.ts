import { expect, test, vi } from "vitest";
const http = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/shared/api/http-client", () => ({ http }));
import { songQueryKeys } from "../index";

import { getSongDetail } from "./api";
import { songQueries } from "./index";

test("public song requests keep the encoded slug, cancellation and query identity", async () => {
  const signal = new AbortController().signal;
  http.get.mockResolvedValue({ invalid: true });
  await expect(getSongDetail("space / slug", signal)).rejects.toThrow(
    "API response contract violation",
  );
  expect(http.get).toHaveBeenCalledWith("/api/songs/space%20%2F%20slug", { signal });
  expect(songQueries.detail("fixture").queryKey).toEqual(songQueryKeys.detail("fixture"));
});
