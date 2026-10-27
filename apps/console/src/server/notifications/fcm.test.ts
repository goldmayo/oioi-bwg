import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getPushConfig, getPushCredentials } from "./config";
import { createFcmSender } from "./fcm";

const mocks = vi.hoisted(() => ({ token: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    getAccessToken = mocks.token;
  },
}));
const target = {
  fid: "c1234567890123456789012",
  notificationId: "019a1234-5678-7000-8000-000000000001",
  installationId: "019a1234-5678-7000-8000-000000000002",
  bindingVersion: 1,
  expiresAt: "2099-01-01T00:00:00Z",
};
beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubEnv("CONSOLE_PUSH_ENABLED", "true");
  vi.stubEnv("CONSOLE_ORIGIN", "https://console.example.test");
  vi.stubEnv("FIREBASE_PROJECT_ID", "test-project");
  vi.stubEnv("FIREBASE_API_KEY", "test-public-key");
  vi.stubEnv("FIREBASE_APP_ID", "test-app");
  vi.stubEnv("FIREBASE_MESSAGING_SENDER_ID", "123456");
  vi.stubEnv("FIREBASE_VAPID_PUBLIC_KEY", "B".repeat(87));
  vi.stubEnv(
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    JSON.stringify({
      project_id: "test-project",
      client_email: "push@example.test",
      private_key: "unit-secret",
    }),
  );
  mocks.token.mockResolvedValue("unit-oauth-secret");
});
test("일반 안내와 알림 ID만 보내고 TTL·동일 Origin 이동·중복 tag를 지정한다", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{"name":"accepted"}', { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  await createFcmSender()(target);
  const [url, options] = fetcher.mock.calls[0]!;
  expect(url).toBe("https://fcm.googleapis.com/v1/projects/test-project/messages:send");
  const payload = JSON.parse(options.body as string);
  expect(payload.message.fid).toBe(target.fid);
  expect(payload.message.data).toEqual({ notificationId: target.notificationId });
  expect(payload.message.webpush.headers.TTL).toBe("86400");
  expect(payload.message.webpush.notification.tag).toBe(target.notificationId);
  expect(payload.message.webpush.fcm_options.link).toBe(
    `https://console.example.test/admin/notifications?notificationId=${target.notificationId}`,
  );
  expect(options.body).not.toContain("unit-secret");
});
test("기기 무효·할당량·인증·메시지 오류를 재시도 정책으로 정규화한다", async () => {
  for (const [status, body, code] of [
    [404, { error: { details: [{ errorCode: "UNREGISTERED" }] } }, "UNREGISTERED"],
    [429, {}, "QUOTA"],
    [403, {}, "AUTHENTICATION"],
    [400, {}, "INVALID_MESSAGE"],
    [503, {}, "NETWORK"],
  ] as const) {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(body), { status, headers: { "retry-after": "120" } }),
        ),
    );
    await expect(createFcmSender()(target)).rejects.toMatchObject({ code });
    if (status === 429)
      await expect(createFcmSender()(target)).rejects.toMatchObject({ retryAfterMs: 120_000 });
  }
});
test("비활성·잘못된 설정·다른 프로젝트 credential은 비밀을 노출하지 않는다", () => {
  vi.stubEnv("CONSOLE_PUSH_ENABLED", "false");
  expect(getPushConfig()).toBeNull();
  expect(() => getPushCredentials("another-project")).toThrow("Invalid Console push credentials");
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", "unit-secret-invalid-json");
  expect(() => getPushCredentials("test-project")).toThrow("Invalid Console push credentials");
});
