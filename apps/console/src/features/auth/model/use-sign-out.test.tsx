import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import {
  NavigationConfirmationProvider,
  useNavigationBlocker,
} from "@/shared/model/navigation-confirmation";

import { useSignOut } from "./use-sign-out";

const { signOut, capture } = vi.hoisted(() => ({ signOut: vi.fn(), capture: vi.fn() }));
vi.mock("../api/actions", () => ({ signOut }));
vi.mock("@/shared/api/capture-client-error", () => ({ captureClientErrorOnce: capture }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("확인을 열거나 취소하는 단계에서는 세션을 종료하지 않는다", () => {
  const { result } = renderHook(useSignOut);
  act(() => result.current.request());
  expect(result.current.open).toBe(true);
  act(() => result.current.cancel());
  expect(result.current.open).toBe(false);
  expect(signOut).not.toHaveBeenCalled();
});

it("미저장 이탈 가드가 승인해야 세션 종료를 실행한다", async () => {
  const block = vi.fn();
  function Blocker() {
    useNavigationBlocker(block);
    return null;
  }
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NavigationConfirmationProvider>
        <Blocker />
        {children}
      </NavigationConfirmationProvider>
    );
  }
  const { result } = renderHook(useSignOut, { wrapper: Wrapper });
  act(() => result.current.request());
  act(() => result.current.confirm());
  expect(result.current.open).toBe(false);
  expect(block).toHaveBeenCalledOnce();
  expect(signOut).not.toHaveBeenCalled();
  await act(async () => block.mock.calls[0][0]());
  expect(signOut).toHaveBeenCalledOnce();
});

it("중복 실행을 막고 실패 시 고정 안내로 다시 확인할 수 있다", async () => {
  let reject!: (error: Error) => void;
  signOut.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  const { result } = renderHook(useSignOut);
  act(() => {
    result.current.request();
    result.current.confirm();
    result.current.confirm();
  });
  expect(result.current.pending).toBe(true);
  expect(signOut).toHaveBeenCalledOnce();
  await act(async () => reject(new Error("private fixture error")));
  await waitFor(() => expect(result.current.pending).toBe(false));
  expect(result.current.open).toBe(true);
  expect(result.current.error).toBe("로그아웃하지 못했습니다. 다시 시도해 주세요.");
  expect(capture).toHaveBeenCalledWith(new Error("Console sign-out request failed"), {
    source: "admin-sign-out",
  });
  await act(async () => result.current.confirm());
  expect(signOut).toHaveBeenCalledTimes(2);
});
