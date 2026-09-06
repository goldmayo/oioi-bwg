import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminAlbumSummary } from "@/entities/album";
import type { AdminSongSummary } from "@/entities/song";

import { ApiError } from "@/shared/api/http-errors";

import { SongFormDialog } from "./SongFormDialog";
import { SongManagerTable } from "./SongManagerTable";

vi.mock("@/shared/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Dialog: ({ children, open }: { children?: ReactNode; open: boolean }) =>
      open ? <div>{children}</div> : null,
    DialogContent: Part,
    DialogDescription: Part,
    DialogFooter: Part,
    DialogHeader: Part,
    DialogTitle: Part,
  };
});

vi.mock("@/shared/ui/select", () => {
  const Part = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Select: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    SelectContent: Part,
    SelectItem: Part,
    SelectTrigger: ({ children, ...props }: { children?: ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  };
});

vi.mock("@/shared/ui/switch", () => ({
  Switch: ({ checked, ...props }: { checked?: boolean }) => (
    <button type="button" role="switch" aria-checked={checked} {...props} />
  ),
}));

vi.mock("./LrcUploader", () => ({
  LrcUploader: ({ error }: { error?: string }) => <div>{error}</div>,
}));

const album: AdminAlbumSummary = {
  id: 1,
  name: "Test Album",
  slug: "test-album",
  imgUrl: "https://assets.example.com/test.webp",
  color: "#000000",
  releaseDate: null,
  isVisible: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const song: AdminSongSummary = {
  id: 2,
  albumId: album.id,
  title: "Test Song",
  slug: "test-song",
  youtubeId: "youtube-id",
  hasOfficialCheer: false,
  isTitle: false,
  isVisible: true,
  order: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  album: { name: album.name },
};

afterEach(() => cleanup());

describe("SongFormDialog slug policy", () => {
  it("shows an existing non-null slug as read-only", () => {
    render(
      <SongFormDialog
        open
        onOpenChange={vi.fn()}
        albums={[album]}
        song={song}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Slug").hasAttribute("readonly")).toBe(true);
    expect(screen.getByText("한 번 지정한 slug는 변경할 수 없습니다.")).toBeTruthy();
  });

  it("allows a legacy null slug to remain empty", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <SongFormDialog
        open
        onOpenChange={vi.fn()}
        albums={[album]}
        song={{ ...song, slug: null }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("Slug").hasAttribute("readonly")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ slug: "" })),
    );
  });

  it.each(["SONG_SLUG_ALREADY_EXISTS", "SONG_SLUG_IMMUTABLE"] as const)(
    "maps %s to the slug field",
    async (code) => {
      const message =
        code === "SONG_SLUG_ALREADY_EXISTS"
          ? "이미 사용 중인 곡 slug입니다."
          : "한 번 지정한 곡 slug는 변경할 수 없습니다.";
      const onSubmit = vi.fn().mockRejectedValue(new ApiError(409, { code, message }));
      render(
        <SongFormDialog
          open
          onOpenChange={vi.fn()}
          albums={[album]}
          song={{ ...song, slug: null }}
          onSubmit={onSubmit}
        />,
      );

      fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "first-slug" } });
      fireEvent.click(screen.getByRole("button", { name: "수정" }));

      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.getByLabelText("Slug").getAttribute("aria-invalid")).toBe("true");
    },
  );
});

describe("SongManagerTable legacy slug", () => {
  it("renders a null slug without creating an editor link", () => {
    render(
      <SongManagerTable
        songs={[{ ...song, slug: null }]}
        canManage
        hasFilter={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("미지정")).toBeTruthy();
    expect(screen.queryByRole("link", { name: song.title })).toBeNull();
  });
});
