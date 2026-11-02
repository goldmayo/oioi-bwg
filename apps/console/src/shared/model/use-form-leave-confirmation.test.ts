import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { useFormLeaveConfirmation } from "./use-form-leave-confirmation";

afterEach(cleanup);
it("브라우저가 이전 페이지를 복원하면 과거 이탈 허용을 초기화한다", () => {
  const { result, rerender } = renderHook(({ dirty }) => useFormLeaveConfirmation(dirty), {
    initialProps: { dirty: false },
  });
  act(() => result.current.release());
  window.dispatchEvent(new Event("pageshow"));
  rerender({ dirty: true });
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
});
