import { expect, it } from "vitest";

import { getEditorReturnTarget } from "./editor-return-target";

it("허용한 복귀 주소의 query·fragment와 목적지 문구를 함께 유지한다", () => {
  expect(
    getEditorReturnTarget("/admin/songs/123?edit=true#song-guides", "123", "guideList"),
  ).toEqual({ href: "/admin/songs/123?edit=true#song-guides", label: "곡 정보로 돌아가기" });
});
it.each(["//evil.test", "/admin/songs/other", ["/admin/cheer-guides"]])(
  "잘못된 복귀 입력 %j는 지정한 기본 대상으로 제한한다",
  (value) => {
    expect(getEditorReturnTarget(value, "123", "guideList")).toEqual({
      href: "/admin/cheer-guides",
      label: "응원법 목록으로 돌아가기",
    });
  },
);
it("구주소의 기본 곡 정보 복귀를 보존한다", () => {
  expect(getEditorReturnTarget(undefined, "123", "song")).toEqual({
    href: "/admin/songs/123",
    label: "곡 정보로 돌아가기",
  });
});
