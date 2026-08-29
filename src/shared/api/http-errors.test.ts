import ky from "ky";
import { describe, expect, it } from "vitest";

import { ApiError, normalizeHttpError } from "./http-errors";

describe("normalizeHttpError", () => {
  it("converts a Ky v2 HTTPError body into ApiError", async () => {
    const client = ky.create({
      fetch: async () =>
        new Response(
          JSON.stringify({ code: "SONG_NOT_FOUND", message: "곡을 찾을 수 없습니다." }),
          {
            headers: { "content-type": "application/json" },
            status: 404,
          },
        ),
      retry: { limit: 0 },
    });

    const error = await client
      .get("https://example.test/songs/missing")
      .json()
      .catch(normalizeHttpError);

    expect(error).toMatchObject({
      code: "SONG_NOT_FOUND",
      message: "곡을 찾을 수 없습니다.",
      status: 404,
    } satisfies Partial<ApiError>);
  });
});
