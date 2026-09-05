import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppError } from "@/server/errors/app-error";

const getRequestContext = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());
const uploadAlbumImage = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/request-context", () => ({ getRequestContext }));
vi.mock("@/server/services/album-image-service", () => ({ uploadAlbumImage }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: loggerError } }));

import { uploadAlbumImageAction } from "./upload-album-image-action";

const context = { ability: {}, user: { id: "42" } };

describe("uploadAlbumImageAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestContext.mockResolvedValue(context);
  });

  it("passes the request context and FormData file to the upload service", async () => {
    const file = new File([new Uint8Array([1])], "album.webp", { type: "image/webp" });
    const formData = new FormData();
    formData.set("file", file);
    uploadAlbumImage.mockResolvedValue({
      url: "https://assets.oioibawige.com/images/albums/image-id.webp",
    });

    await expect(uploadAlbumImageAction(formData)).resolves.toEqual({
      success: true,
      url: "https://assets.oioibawige.com/images/albums/image-id.webp",
    });
    expect(getRequestContext).toHaveBeenCalledTimes(1);
    expect(uploadAlbumImage).toHaveBeenCalledWith(context, file);
  });

  it("returns the service validation message without logging it", async () => {
    const validationError = z.string().min(1, "파일이 없습니다.").safeParse("").error;
    uploadAlbumImage.mockRejectedValue(validationError);

    await expect(uploadAlbumImageAction(new FormData())).resolves.toEqual({
      success: false,
      error: "파일이 없습니다.",
    });
    expect(uploadAlbumImage).toHaveBeenCalledWith(context, null);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it.each([
    ["authorization", new AppError("FORBIDDEN")],
    ["storage", new Error("R2_SECRET_ACCESS_KEY=PRIVATE_MARKER")],
  ])("does not expose the raw %s error", async (_label, rawError) => {
    uploadAlbumImage.mockRejectedValue(rawError);

    const result = await uploadAlbumImageAction(new FormData());

    expect(result).toEqual({ success: false, error: "이미지 업로드에 실패했습니다." });
    expect(JSON.stringify(result)).not.toContain(rawError.message);
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Album image upload failed",
        name: "AlbumImageUploadError",
      }),
      { source: "upload-album-image-action" },
    );
    expect(loggerError.mock.calls[0]?.[0]).not.toBe(rawError);
  });
});
