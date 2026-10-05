import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountRole } from "../db/schema";
import { AppError } from "../errors/app-error";

const uploadPublicAsset = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("../storage/upload-public-asset", () => ({ uploadPublicAsset }));

import { buildAbility } from "../auth/ability";
import type { RequestContext } from "../auth/request-context";

import { uploadAlbumImage } from "./album-image-service";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function requestContext(role: AccountRole | null): RequestContext {
  const accountId = role ? "42" : null;
  return {
    user: accountId ? { id: accountId } : null,
    ability: buildAbility({ accountId, role }),
  } as RequestContext;
}

function imageFile(type: string, size = 1) {
  return new File([new Uint8Array(size)], "album-image", { type });
}

describe("uploadAlbumImage authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadPublicAsset.mockResolvedValue({
      url: "https://assets.oioibawige.com/images/albums/image-id.webp",
    });
  });

  it.each([
    ["guest", null, "UNAUTHENTICATED"],
    ["USER", "USER", "FORBIDDEN"],
    ["REVIEWER", "REVIEWER", "FORBIDDEN"],
  ] as const)("rejects %s before validating or uploading the file", async (_label, role, code) => {
    const context = requestContext(role);

    await expect(uploadAlbumImage(context, null)).rejects.toEqual(new AppError(code));
    await expect(uploadAlbumImage(context, imageFile("image/webp"))).rejects.toEqual(
      new AppError(code),
    );
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });

  it("allows ADMIN and uploads only after validation", async () => {
    await expect(
      uploadAlbumImage(requestContext("ADMIN"), imageFile("image/webp")),
    ).resolves.toEqual({
      url: "https://assets.oioibawige.com/images/albums/image-id.webp",
    });
    expect(uploadPublicAsset).toHaveBeenCalledTimes(1);
  });
});

describe("uploadAlbumImage validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadPublicAsset.mockResolvedValue({
      url: "https://assets.oioibawige.com/images/albums/image-id.webp",
    });
  });

  it.each([
    ["missing file", null, "파일이 없습니다."],
    ["string entry", "not-a-file", "파일이 없습니다."],
    [
      "oversized file",
      imageFile("image/webp", MAX_IMAGE_SIZE + 1),
      "파일 크기는 5MB 이하여야 합니다.",
    ],
    [
      "unsupported MIME",
      imageFile("image/gif"),
      "AVIF, JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.",
    ],
  ])("rejects %s before storage", async (_label, rawFile, message) => {
    await expect(uploadAlbumImage(requestContext("ADMIN"), rawFile)).rejects.toThrow(message);
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });

  it.each([
    ["image/avif", "avif"],
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ])("maps %s to the %s extension", async (contentType, extension) => {
    const file = imageFile(contentType, 2);

    await uploadAlbumImage(requestContext("ADMIN"), file);

    expect(uploadPublicAsset).toHaveBeenCalledWith({
      objectKey: expect.stringMatching(new RegExp(`^images/albums/[0-9a-f-]{36}\\.${extension}$`)),
      body: new Uint8Array([0, 0]),
      contentType,
    });
  });

  it("accepts a file at the exact 5 MiB boundary", async () => {
    await uploadAlbumImage(requestContext("ADMIN"), imageFile("image/png", MAX_IMAGE_SIZE));

    const input = uploadPublicAsset.mock.calls[0]?.[0] as { body: Uint8Array };
    expect(input.body).toHaveLength(MAX_IMAGE_SIZE);
    expect(uploadPublicAsset).toHaveBeenCalledTimes(1);
  });
});
