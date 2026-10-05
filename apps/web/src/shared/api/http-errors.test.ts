import ky, { NetworkError, TimeoutError } from "ky";
import { describe, expect, it } from "vitest";

import { ApiError, ClientTransportError, normalizeHttpError } from "./http-errors";

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

  it("classifies a malformed HTTP error body as an HTTP transport error", async () => {
    const client = ky.create({
      fetch: async () => new Response("not-json", { status: 502 }),
      retry: { limit: 0 },
    });

    const error = await client.get("https://example.test/broken").json().catch(normalizeHttpError);

    expect(error).toMatchObject({
      code: "HTTP_ERROR",
      status: 502,
    } satisfies Partial<ClientTransportError>);
  });

  it.each([
    [new NetworkError(new Request("https://example.test")), "NETWORK_ERROR"],
    [new TimeoutError(new Request("https://example.test")), "TIMEOUT_ERROR"],
  ])("classifies Ky transport failures", (sourceError, code) => {
    expect(normalizeHttpError(sourceError)).toMatchObject({ code });
  });
});
