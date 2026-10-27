import { afterEach, expect, test, vi } from "vitest";

import { GET } from "./route";
afterEach(() => vi.unstubAllEnvs());
test("공개 SW는 runtime 설정만 포함하고 disabled이면 등록을 해제한다", async () => {
  vi.stubEnv("CONSOLE_PUSH_ENABLED", "false");
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", "must-never-be-in-worker");
  const response = await GET();
  expect(response.headers.get("Content-Type")).toContain("text/javascript");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Service-Worker-Allowed")).toBe("/");
  const body = await response.text();
  expect(body).toContain("unregister");
  expect(body).not.toContain("must-never-be-in-worker");
});
test("활성 SW에도 credential을 포함하지 않고 공개 설정과 로컬 SDK만 전달한다", async () => {
  for (const [name, value] of Object.entries({
    CONSOLE_PUSH_ENABLED: "true",
    FIREBASE_PROJECT_ID: "test-project",
    FIREBASE_API_KEY: "public-api-key",
    FIREBASE_APP_ID: "web-app",
    FIREBASE_MESSAGING_SENDER_ID: "123456",
    FIREBASE_VAPID_PUBLIC_KEY: "B".repeat(87),
    FIREBASE_SERVICE_ACCOUNT_JSON: "must-never-be-in-worker",
  }))
    vi.stubEnv(name, value);
  const response = await GET();
  const body = await response.text();
  expect(body).toContain("public-api-key");
  expect(body).toContain('importScripts("/notification-worker.js")');
  expect(body).not.toContain("must-never-be-in-worker");
});
