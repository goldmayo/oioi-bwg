import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clientOptions = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = send;

    constructor(options: unknown) {
      clientOptions(options);
    }
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { uploadPublicAsset } from "./upload-public-asset";

beforeEach(() => {
  vi.stubEnv("R2_ENDPOINT", "https://account.r2.cloudflarestorage.com");
  vi.stubEnv("R2_BUCKET", "oioibawige-r2-staging");
  vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-key");
  vi.stubEnv("ASSETS_PUBLIC_BASE_URL", "https://assets.oioibawige.com/");
});

afterEach(() => {
  vi.unstubAllEnvs();
  clientOptions.mockReset();
  send.mockReset();
});

describe("uploadPublicAsset", () => {
  it("uploads through R2 and returns the custom-domain canonical URL", async () => {
    send.mockResolvedValue({});

    await expect(
      uploadPublicAsset({
        objectKey: "images/albums/image-id.webp",
        body: new Uint8Array([1]),
        contentType: "image/webp",
      }),
    ).resolves.toEqual({ url: "https://assets.oioibawige.com/images/albums/image-id.webp" });

    expect(clientOptions).toHaveBeenCalledWith({
      endpoint: "https://account.r2.cloudflarestorage.com/",
      region: "auto",
      credentials: {
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
      },
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: "oioibawige-r2-staging",
          Key: "images/albums/image-id.webp",
          Body: new Uint8Array([1]),
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        },
      }),
    );
  });

  it.each([
    ["R2_ENDPOINT", ""],
    ["R2_BUCKET", "   "],
    ["R2_ACCESS_KEY_ID", ""],
    ["R2_SECRET_ACCESS_KEY", ""],
    ["ASSETS_PUBLIC_BASE_URL", ""],
    ["ASSETS_PUBLIC_BASE_URL", "invalid-private-url"],
    ...["R2_ENDPOINT", "ASSETS_PUBLIC_BASE_URL"].flatMap((name) =>
      ["https://example.test/?", "https://example.test/#", "https://example.test/?#"].map<
        [string, string]
      >((value) => [name, value]),
    ),
  ])("rejects unusable %s before creating a client or uploading", async (name, value) => {
    vi.stubEnv(name, value);
    await expect(
      uploadPublicAsset({
        objectKey: "image.webp",
        body: new Uint8Array([1]),
        contentType: "image/webp",
      }),
    ).rejects.toThrow(new RegExp(`^${name} `));
    expect(clientOptions).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ["  https://ASSETS.EXAMPLE.TEST:443/base/  ", "https://assets.example.test/base"],
    ["https://assets.example.test/base/../base///\t", "https://assets.example.test/base"],
    ["https://assets.example.test/base%3F%23/", "https://assets.example.test/base%3F%23"],
  ])("returns a canonical asset path for %s", async (value, baseUrl) => {
    vi.stubEnv("ASSETS_PUBLIC_BASE_URL", value);
    const { url } = await uploadPublicAsset({
      objectKey: "images/albums/example.webp",
      body: new Uint8Array([1]),
      contentType: "image/webp",
    });
    expect(url).toBe(`${baseUrl}/images/albums/example.webp`);
    expect(new URL(url).search).toBe("");
    expect(new URL(url).hash).toBe("");
  });
});
