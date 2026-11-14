import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import {
  defaultDashboardLayout,
  saveDashboardLayout,
  useSavedDashboardLayout,
} from "./dashboard-layout";

const accountId = "dashboard-test";
const legacyKey = "console:dashboard-layout:v2:" + accountId;
const currentKey = "console:dashboard-layout:v3:" + accountId;

afterEach(() => {
  cleanup();
  localStorage.removeItem(legacyKey);
  localStorage.removeItem(currentKey);
});

it("기존 6열 배치의 순서와 숨김을 유지하고 12열 배치로 다시 저장한다", () => {
  const mobile = [...defaultDashboardLayout.mobile].reverse();
  const legacy = {
    desktop: [
      { i: "content", x: 2, y: 0, w: 4, h: 5 },
      { i: "jobs", x: 0, y: 0, w: 2, h: 5 },
      { i: "summary", x: 0, y: 7, w: 6, h: 3 },
      { i: "trend", x: 0, y: 10, w: 6, h: 16 },
      { i: "pages", x: 0, y: 26, w: 3, h: 11 },
      { i: "traffic", x: 3, y: 26, w: 3, h: 11 },
      { i: "devices", x: 0, y: 37, w: 3, h: 11 },
      { i: "browsers", x: 3, y: 37, w: 3, h: 11 },
    ],
    mobile,
    hidden: ["browsers"],
  };
  localStorage.setItem(legacyKey, JSON.stringify(legacy));

  const { result } = renderHook(() => useSavedDashboardLayout(accountId));
  expect(result.current?.desktop).toContainEqual({ i: "content", x: 4, y: 0, w: 8, h: 7 });
  expect(result.current?.desktop).toContainEqual({ i: "trend", x: 0, y: 14, w: 12, h: 22 });
  expect(result.current?.mobile).toEqual(mobile);
  expect(result.current?.hidden).toEqual(["browsers"]);

  act(() => saveDashboardLayout(accountId, defaultDashboardLayout));
  expect(result.current).toEqual(defaultDashboardLayout);
  expect(JSON.parse(localStorage.getItem(legacyKey)!)).toEqual(legacy);
});
