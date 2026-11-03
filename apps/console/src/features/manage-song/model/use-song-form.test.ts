import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { AdminSongSummary } from "@/entities/song";

import { getSongFormDefaults } from "../lib/song-form";

import { songEditSchema } from "./schemas";
import { useSongForm } from "./use-song-form";

const song: AdminSongSummary = {
  id: "019a0170-0000-7000-8000-000000000001",
  albumId: "019a0170-0000-7000-8000-000000000002",
  album: { name: "앨범" },
  title: "곡",
  slug: null,
  youtubeId: "video",
  hasOfficialCheer: false,
  isTitle: false,
  isVisible: true,
  order: 1,
  updatedAt: "",
  guideWrite: { guideId: "019a0170-0000-7000-8000-000000000003", lockVersion: 1 },
};

it("재조회 뒤에도 시작 버전으로 한 번만 제출하고 저장 성공 후 재진입을 막는다", async () => {
  let complete!: () => void;
  const submit = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const saved = vi.fn();
  const { result, rerender } = renderHook(
    ({ value }) =>
      useSongForm({
        song: value,
        onSubmit: submit,
        onSaved: saved,
      }),
    { initialProps: { value: song } },
  );
  rerender({ value: { ...song, guideWrite: { ...song.guideWrite!, lockVersion: 7 } } });
  const values = songEditSchema.parse(getSongFormDefaults(song));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.handleSubmit(values);
  });
  await act(() => result.current.handleSubmit(values));
  expect(submit).toHaveBeenCalledExactlyOnceWith(values, song.guideWrite);
  await act(async () => {
    complete();
    await pending;
  });
  await act(() => result.current.handleSubmit(values));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(saved).toHaveBeenCalledTimes(1);
});

it("저장 실패 시 입력을 보존하고 재시도를 허용한다", async () => {
  const submit = vi
    .fn()
    .mockRejectedValueOnce(new Error("저장 실패"))
    .mockResolvedValueOnce(undefined);
  const saved = vi.fn();
  const { result } = renderHook(() => useSongForm({ song, onSubmit: submit, onSaved: saved }));
  act(() => result.current.form.setValue("title", "수정 중", { shouldDirty: true }));
  const values = songEditSchema.parse(result.current.form.getValues());
  await act(() => result.current.handleSubmit(values));
  expect(result.current.form.getValues("title")).toBe("수정 중");
  expect(result.current.isSubmitting).toBe(false);
  expect(saved).not.toHaveBeenCalled();
  await act(() => result.current.handleSubmit(values));
  expect(submit).toHaveBeenCalledTimes(2);
  expect(saved).toHaveBeenCalledTimes(1);
});
