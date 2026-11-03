import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminAlbumSummary } from "@/entities/album";

import { AlbumForm } from "./AlbumForm";

vi.mock("@/shared/ui/switch", () => ({
  Switch: ({ checked }: { checked?: boolean }) => (
    <button type="button" role="switch" aria-checked={checked} />
  ),
}));
const album: AdminAlbumSummary = {
  id: "019a0170-0000-7000-8000-000000000001",
  name: "Original album",
  slug: "original-album",
  imgUrl: "https://assets.example.com/album.webp",
  color: "#000000",
  releaseDate: null,
  isVisible: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};
afterEach(cleanup);

describe("AlbumForm edit session", () => {
  it("reopens with the saved DTO and submits its current name", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const props = { onCancel: vi.fn(), onSaved: vi.fn(), onUploadImage: vi.fn(), onSubmit };
    const { rerender } = render(<AlbumForm {...props} album={album} />);
    fireEvent.change(screen.getByLabelText("앨범 이름"), { target: { value: "Saved album" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const updated = { ...album, name: "Saved album" };
    rerender(<></>);
    rerender(<AlbumForm {...props} album={updated} />);
    expect((screen.getByLabelText("앨범 이름") as HTMLInputElement).value).toBe(updated.name);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ name: updated.name })),
    );
  });

  it("preserves a dirty name across background DTO refresh", () => {
    const props = {
      onCancel: vi.fn(),
      onSaved: vi.fn(),
      onUploadImage: vi.fn(),
      onSubmit: vi.fn(),
    };
    const { rerender } = render(<AlbumForm {...props} album={album} />);
    fireEvent.change(screen.getByLabelText("앨범 이름"), { target: { value: "Unsaved album" } });
    rerender(<AlbumForm {...props} album={{ ...album, name: "Background album" }} />);
    expect((screen.getByLabelText("앨범 이름") as HTMLInputElement).value).toBe("Unsaved album");
  });

  it("discards a cancelled draft on the next explicit open", () => {
    const props = {
      onCancel: vi.fn(),
      onSaved: vi.fn(),
      onUploadImage: vi.fn(),
      onSubmit: vi.fn(),
    };
    const { rerender } = render(<AlbumForm {...props} album={album} />);
    fireEvent.change(screen.getByLabelText("앨범 이름"), { target: { value: "Cancelled album" } });
    rerender(<></>);
    rerender(<AlbumForm {...props} album={album} />);
    expect((screen.getByLabelText("앨범 이름") as HTMLInputElement).value).toBe(album.name);
  });
});

it("preserves the open draft and blocks submission until authorization returns", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const props = { onCancel: vi.fn(), onSaved: vi.fn(), onUploadImage: vi.fn(), onSubmit };
  const { rerender } = render(<AlbumForm {...props} album={album} />);
  fireEvent.change(screen.getByLabelText("앨범 이름"), { target: { value: "Unsaved album" } });
  rerender(
    <AlbumForm
      {...props}
      album={album}
      canSubmit={false}
      submissionNotice={<p role="alert">다시 로그인</p>}
    />,
  );
  expect(screen.getByRole("alert").textContent).toBe("다시 로그인");
  expect((screen.getByLabelText("앨범 이름") as HTMLInputElement).value).toBe("Unsaved album");
  expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(screen.getByRole("button", { name: "저장" }).closest("form")!);
  await waitFor(() =>
    expect((screen.getByLabelText("앨범 이름") as HTMLInputElement).value).toBe("Unsaved album"),
  );
  expect(onSubmit).not.toHaveBeenCalled();
  rerender(<AlbumForm {...props} album={album} canSubmit />);
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Unsaved album" })),
  );
});

it("취소·앱 내 이탈 확인에서 계속 편집하면 초안을 보존한다", async () => {
  const onCancel = vi.fn();
  render(
    <AlbumForm
      album={album}
      onUploadImage={vi.fn()}
      onSubmit={vi.fn()}
      onSaved={vi.fn()}
      onCancel={onCancel}
    />,
  );
  fireEvent.change(screen.getByLabelText("앨범 이름"), { target: { value: "미저장 앨범" } });
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "계속 편집" }));
  expect(onCancel).not.toHaveBeenCalled();
  expect((screen.getByLabelText("앨범 이름") as HTMLInputElement).value).toBe("미저장 앨범");
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  fireEvent.click(screen.getByRole("button", { name: "저장하지 않고 나가기" }));
  expect(onCancel).toHaveBeenCalledOnce();
});
it("저장 중 중복 제출을 방어하고 실패 후 초안을 유지한다", async () => {
  let reject!: (error: Error) => void;
  const onSubmit = vi.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  render(
    <AlbumForm
      album={album}
      onUploadImage={vi.fn()}
      onSubmit={onSubmit}
      onSaved={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("앨범 이름"), { target: { value: "미저장 앨범" } });
  const form = screen.getByRole("button", { name: "저장" }).closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect((screen.getByRole("button", { name: "취소" }) as HTMLButtonElement).disabled).toBe(true);
  reject(new Error("저장 실패"));
  await screen.findByText("저장 실패");
  expect((screen.getByLabelText("앨범 이름") as HTMLInputElement).value).toBe("미저장 앨범");
});
it("업로드 실패의 busy 상태를 해제하고 같은 파일을 다시 받을 수 있다", async () => {
  const upload = vi
    .fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({ success: true, url: "https://assets.example.com/new.webp" });
  const { container } = render(
    <AlbumForm
      album={album}
      onUploadImage={upload}
      onSubmit={vi.fn()}
      onSaved={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  const input = container.querySelector('input[type="file"]')!;
  const file = new File(["fixture"], "album.webp", { type: "image/webp" });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText("이미지를 업로드하지 못했습니다. 다시 시도해주세요.");
  expect(
    (screen.getByRole("button", { name: "앨범 이미지 업로드" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect((screen.getByLabelText("이미지 URL") as HTMLInputElement).value).toBe(
      "https://assets.example.com/new.webp",
    ),
  );
});
