import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { useFormLeaveConfirmation } from "@/shared/model/use-form-leave-confirmation";
import { UnsavedChangesDialog } from "@/shared/ui/unsaved-changes-dialog";

import { EditorReturnBar } from "./EditorReturnBar";

afterEach(cleanup);
function Page({ dirty = false, busy = false }: { dirty?: boolean; busy?: boolean }) {
  const leave = useFormLeaveConfirmation(dirty, busy);
  return (
    <>
      <EditorReturnBar target={{ href: "/admin/songs/123", label: "곡 정보로 돌아가기" }} />
      <UnsavedChangesDialog open={leave.open} onStay={leave.stay} onLeave={leave.leave} />
    </>
  );
}
it("복귀 주소·문구만 표시하고 루트 브레드크럼을 중복 생성하지 않는다", () => {
  render(<Page />);
  expect(screen.getByRole("link", { name: "곡 정보로 돌아가기" }).getAttribute("href")).toBe(
    "/admin/songs/123",
  );
  expect(screen.queryByRole("navigation", { name: "현재 위치" })).toBeNull();
});
it("미저장 복귀를 확인하고 계속 편집하면 페이지를 유지한다", () => {
  render(<Page dirty />);
  fireEvent.click(screen.getByRole("link", { name: "곡 정보로 돌아가기" }));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "계속 편집" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
});
it("저장 중 복귀를 막고 저장 완료 후 이탈 경고를 해제한다", () => {
  const { rerender } = render(<Page dirty busy />);
  const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  screen.getByRole("link", { name: "곡 정보로 돌아가기" }).dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  rerender(<Page />);
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(false);
});
