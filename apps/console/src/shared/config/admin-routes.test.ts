import { expect, it } from "vitest";

import { adminLinks, adminPaths, getAdminPageId } from "./admin-routes";

it.each(Object.entries(adminPaths))("화면 %s의 고정·동적 경로를 식별한다", (id, path) => {
  expect(getAdminPageId(path.replace(/\[(?:id|slug)\]/, "value"))).toBe(id);
});
it.each([
  "/admin/songs-unknown",
  "/admin/songs/",
  "/admin/songs/id/edit",
  "/admin/cheer-guides/id/edit/extra",
])("허용하지 않은 경로 %s를 다른 화면으로 오인하지 않는다", (path) => {
  expect(getAdminPageId(path)).toBeUndefined();
});
it("기존 URL·query·fragment와 구주소를 유지한다", () => {
  expect(adminLinks.song("123")).toBe("/admin/songs/123");
  expect(adminLinks.songEdit("123")).toBe("/admin/songs/123?edit=true");
  expect(adminLinks.songGuides("123")).toBe("/admin/songs/123#song-guides");
  expect(adminLinks.guideCreate("123")).toBe("/admin/cheer-guides/new?songId=123");
  expect(adminLinks.guideEdit("123", "/admin/songs/456?edit=true")).toBe(
    "/admin/cheer-guides/123/edit?returnTo=%2Fadmin%2Fsongs%2F456%3Fedit%3Dtrue",
  );
  expect(adminLinks.songLyrics("한/곡", "123")).toBe(
    `/admin/edit/${encodeURIComponent("한/곡")}?guideId=123`,
  );
});
