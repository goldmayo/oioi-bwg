import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminAlbumSummary } from "@/entities/album";
import type { AdminSongSummary } from "@/entities/song";

import { ApiError } from "@/shared/api/http-errors";

import { SongForm } from "./SongForm";
import { SongManagerTable } from "./SongManagerTable";

// Slug 표시 회귀는 해당 열이 보이는 데스크톱 화면에서 검증한다.
vi.mock("@/shared/model/useMediaQuery", () => ({ useMediaQuery: () => true }));

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
  id: "019a0170-0000-7000-8000-000000000001",
  name: "Test Album",
  slug: "test-album",
  imgUrl: "https://assets.example.com/test.webp",
  color: "#000000",
  releaseDate: null,
  isVisible: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const song: AdminSongSummary = {
  id: "019a0170-0000-7000-8000-000000000002",
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

describe("SongForm slug policy", () => {
  it("shows an existing non-null slug as read-only", () => {
    render(
      <SongForm
        onCancel={vi.fn()}
        onSaved={vi.fn()}
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
      <SongForm
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        albums={[album]}
        song={{ ...song, slug: null }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("Slug").hasAttribute("readonly")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ slug: "" }), undefined),
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
        <SongForm
          onCancel={vi.fn()}
          onSaved={vi.fn()}
          albums={[album]}
          song={{ ...song, slug: null }}
          onSubmit={onSubmit}
        />,
      );

      fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "first-slug" } });
      fireEvent.click(screen.getByRole("button", { name: "저장" }));

      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.getByLabelText("Slug").getAttribute("aria-invalid")).toBe("true");
    },
  );
});

describe("SongManagerTable legacy slug", () => {
  it("links a null slug song to its UUID information page", () => {
    render(
      <SongManagerTable
        selectedIds={new Set()}
        onSelect={() => {}}
        songs={[{ ...song, slug: null }]}
        canManage
        hasFilter={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("미지정")).toBeTruthy();
    expect(screen.getByRole("link", { name: song.title }).getAttribute("href")).toBe(
      `/admin/songs/${song.id}`,
    );
  });
});

describe("SongForm edit session", () => {
  it("reopens with the saved DTO and submits its current title", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const props = { onCancel: vi.fn(), onSaved: vi.fn(), albums: [album], onSubmit };
    const { rerender } = render(<SongForm {...props} song={song} />);
    fireEvent.change(screen.getByLabelText("곡 제목"), { target: { value: "Saved title" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const updated = { ...song, title: "Saved title" };
    rerender(<></>);
    rerender(<SongForm {...props} song={updated} />);
    expect((screen.getByLabelText("곡 제목") as HTMLInputElement).value).toBe(updated.title);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: updated.title }),
        undefined,
      ),
    );
  });

  it("preserves a dirty title across background DTO refresh", () => {
    const props = { onCancel: vi.fn(), onSaved: vi.fn(), albums: [album], onSubmit: vi.fn() };
    const { rerender } = render(<SongForm {...props} song={song} />);
    fireEvent.change(screen.getByLabelText("곡 제목"), { target: { value: "Unsaved title" } });
    rerender(<SongForm {...props} song={{ ...song, title: "Background title" }} />);
    expect((screen.getByLabelText("곡 제목") as HTMLInputElement).value).toBe("Unsaved title");
  });

  it("discards a cancelled draft on the next explicit open", () => {
    const props = { onCancel: vi.fn(), onSaved: vi.fn(), albums: [album], onSubmit: vi.fn() };
    const { rerender } = render(<SongForm {...props} song={song} />);
    fireEvent.change(screen.getByLabelText("곡 제목"), { target: { value: "Cancelled title" } });
    rerender(<></>);
    rerender(<SongForm {...props} song={song} />);
    expect((screen.getByLabelText("곡 제목") as HTMLInputElement).value).toBe(song.title);
  });
});

it("preserves the open draft and blocks submission until authorization returns", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const props = { onCancel: vi.fn(), onSaved: vi.fn(), albums: [album], onSubmit };
  const { rerender } = render(<SongForm {...props} song={song} />);
  fireEvent.change(screen.getByLabelText("곡 제목"), { target: { value: "Unsaved song" } });
  rerender(
    <SongForm
      {...props}
      song={song}
      canSubmit={false}
      submissionNotice={<p role="alert">다시 로그인</p>}
    />,
  );
  expect(screen.getByRole("alert").textContent).toBe("다시 로그인");
  expect((screen.getByLabelText("곡 제목") as HTMLInputElement).value).toBe("Unsaved song");
  expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
  await waitFor(() =>
    expect((screen.getByLabelText("곡 제목") as HTMLInputElement).value).toBe("Unsaved song"),
  );
  expect(onSubmit).not.toHaveBeenCalled();
  rerender(<SongForm {...props} song={song} canSubmit />);
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Unsaved song" }),
      undefined,
    ),
  );
});

describe("SongManagerTable Compiler 갱신 회귀", () => {
  it("같은 목록에서 권한이 회수되면 관리 버튼을 제거한다", () => {
    const props = { songs: [song], hasFilter: false, onEdit: vi.fn(), onDelete: vi.fn() };
    const { rerender } = render(
      <SongManagerTable selectedIds={new Set()} onSelect={() => {}} {...props} canManage />,
    );
    expect(screen.getByRole("button", { name: `${song.title} 관리` })).toBeTruthy();
    rerender(
      <SongManagerTable selectedIds={new Set()} onSelect={() => {}} {...props} canManage={false} />,
    );
    expect(screen.queryByRole("button", { name: `${song.title} 관리` })).toBeNull();
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
  });

  it("정렬·페이지 상태가 같아도 새 DTO의 셀과 callback을 반영한다", () => {
    const onEdit = vi.fn();
    const props = { canManage: true, hasFilter: false, onEdit, onDelete: vi.fn() };
    const { rerender } = render(
      <SongManagerTable selectedIds={new Set()} onSelect={() => {}} {...props} songs={[song]} />,
    );
    const updated = { ...song, title: "새 DTO 제목" };
    rerender(
      <SongManagerTable selectedIds={new Set()} onSelect={() => {}} {...props} songs={[updated]} />,
    );
    expect(screen.getByRole("link", { name: updated.title })).toBeTruthy();
    expect(screen.queryByText(song.title)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `${updated.title} 관리` }));
    fireEvent.click(screen.getByRole("button", { name: "편집" }));
    expect(onEdit).toHaveBeenCalledWith(updated);
  });
});
