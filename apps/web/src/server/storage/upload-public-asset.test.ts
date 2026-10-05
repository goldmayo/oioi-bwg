import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  vi.unstubAllEnvs();
  clientOptions.mockReset();
  send.mockReset();
});

describe("uploadPublicAsset", () => {
  it("uploads through R2 and returns the custom-domain canonical URL", async () => {
    vi.stubEnv("R2_ENDPOINT", "https://account.r2.cloudflarestorage.com");
    vi.stubEnv("R2_BUCKET", "oioibawige-r2-staging");
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("ASSETS_PUBLIC_BASE_URL", "https://assets.oioibawige.com/");
    send.mockResolvedValue({});

    await expect(
      uploadPublicAsset({
        objectKey: "images/albums/image-id.webp",
        body: new Uint8Array([1]),
        contentType: "image/webp",
      }),
    ).resolves.toEqual({ url: "https://assets.oioibawige.com/images/albums/image-id.webp" });

    expect(clientOptions).toHaveBeenCalledWith({
      endpoint: "https://account.r2.cloudflarestorage.com",
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
});
