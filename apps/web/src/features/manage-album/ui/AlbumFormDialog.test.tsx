import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminAlbumSummary } from "@/entities/album";

import { AlbumFormDialog } from "./AlbumFormDialog";

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
vi.mock("@/shared/ui/switch", () => ({
  Switch: ({ checked }: { checked?: boolean }) => (
    <button type="button" role="switch" aria-checked={checked} />
  ),
}));
const album: AdminAlbumSummary = {
  id: 1,
  name: "Original album",
  slug: "original-album",
  imgUrl: "https://assets.example.com/album.webp",
  color: "#000000",
  releaseDate: null,
  isVisible: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};
afterEach(cleanup);

describe("AlbumFormDialog edit session", () => {
  it("reopens with the saved DTO and submits its current name", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const props = { onOpenChange: vi.fn(), onUploadImage: vi.fn(), onSubmit };
    const { rerender } = render(<AlbumFormDialog {...props} open album={album} />);
    fireEvent.change(screen.getByLabelText("앨범 이름"), { target: { value: "Saved album" } });
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const updated = { ...album, name: "Saved album" };
    rerender(<AlbumFormDialog {...props} open={false} album={updated} />);
    rerender(<AlbumFormDialog {...props} open album={updated} />);
    expect((screen.getByLabelText("앨범 이름") as HTMLInputElement).value).toBe(updated.name);
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ name: updated.name })),
    );
  });

  it("preserves a dirty name across background DTO refresh", () => {
    const props = { onOpenChange: vi.fn(), onUploadImage: vi.fn(), onSubmit: vi.fn() };
    const { rerender } = render(<AlbumFormDialog {...props} open album={album} />);
    fireEvent.change(screen.getByLabelText("앨범 이름"), { target: { value: "Unsaved album" } });
    rerender(<AlbumFormDialog {...props} open album={{ ...album, name: "Background album" }} />);
    expect((screen.getByLabelText("앨범 이름") as HTMLInputElement).value).toBe("Unsaved album");
  });

  it("discards a cancelled draft on the next explicit open", () => {
    const props = { onOpenChange: vi.fn(), onUploadImage: vi.fn(), onSubmit: vi.fn() };
    const { rerender } = render(<AlbumFormDialog {...props} open album={album} />);
    fireEvent.change(screen.getByLabelText("앨범 이름"), { target: { value: "Cancelled album" } });
    rerender(<AlbumFormDialog {...props} open={false} album={album} />);
    rerender(<AlbumFormDialog {...props} open album={album} />);
    expect((screen.getByLabelText("앨범 이름") as HTMLInputElement).value).toBe(album.name);
  });
});
