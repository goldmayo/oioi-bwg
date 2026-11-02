import { expect, it } from "vitest";

import { safeReturnPath } from "./safe-return-path";

const fallback = "/admin/cheer-guides";
const allowed = [fallback, "/admin/songs/123"];
it("허용된 화면의 검색 조건과 fragment를 보존한다", () => {
  expect(safeReturnPath("/admin/songs/123?edit=true#guides", fallback, allowed)).toBe(
    "/admin/songs/123?edit=true#guides",
  );
});
it.each([
  undefined,
  [fallback],
  "https://evil.test",
  "//evil.test",
  "/\\evil.test",
  "/admin-login",
  "/admin/songs/123/edit",
  "/admin/../admin-login",
  "/admin/cheer-guides\n",
])("허용하지 않은 복귀 주소 %j는 기본 경로로 제한한다", (input) => {
  expect(safeReturnPath(input, fallback, allowed)).toBe(fallback);
});
