import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useGuideCreationForm } from "./use-guide-creation-form";

afterEach(cleanup);
const songId = "019a0170-0000-7000-8000-000000000002";

function setup(onSubmit = vi.fn().mockResolvedValue(undefined), canSubmit = true) {
  const onSaved = vi.fn();
  const { result } = renderHook(() =>
    useGuideCreationForm({ initialSongId: songId, canSubmit, onSubmit, onSaved }),
  );
  act(() => {
    result.current.form.setValue("sourceType", "FANDOM");
  });
  return { result, onSubmit, onSaved };
}

describe("응원법 추가 제출 세션", () => {
  it("진행 중 중복 제출과 성공 후 재제출을 방어한다", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const { result, onSaved } = setup(onSubmit);
    let first!: Promise<void>;
    act(() => {
      first = result.current.submit();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.submit();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve();
      await first;
      await result.current.submit();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it("실패 시 입력을 보존하고 재시도를 허용한다", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("재인증이 필요합니다."))
      .mockResolvedValue(undefined);
    const { result, onSaved } = setup(onSubmit);
    act(() => result.current.form.setValue("description", "보존할 초안", { shouldDirty: true }));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.form.getValues("description")).toBe("보존할 초안");
    expect(result.current.isSubmitting).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.submit();
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it("권한이 없으면 외부 제출을 호출하지 않는다", async () => {
    const { result, onSubmit } = setup(undefined, false);
    await act(async () => {
      await result.current.submit();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
