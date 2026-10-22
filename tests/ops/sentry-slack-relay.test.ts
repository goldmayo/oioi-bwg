import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import worker, { handleSentryWebhook } from "../../workers/sentry-slack-relay/src/index.mts";

const SENTRY_SECRET = "test-sentry-webhook-secret";
const SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/test-secret";
const ENDPOINT_URL = "https://relay.example.test/webhooks/sentry";

const baseEvent = {
  action: "triggered",
  data: {
    event: {
      datetime: "2026-09-20T09:10:11.000Z",
      issue_id: "123456789",
      level: "error",
      metadata: { type: "TypeError", value: "Failed to fetch" },
      project: 42,
      tags: [["environment", "staging"]],
      title: "TypeError: Failed to fetch",
      web_url:
        "https://oioi-bwg.sentry.io/organizations/oioi-bwg/issues/123456789/events/abcdef/?query=sensitive",
    },
  },
};

const sign = async (body: string, secret = SENTRY_SECRET) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const makeRequest = async (
  payload: unknown = baseEvent,
  options: { method?: string; resource?: string; secret?: string; signature?: string } = {},
) => {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signature = options.signature ?? (await sign(body, options.secret));
  return new Request(ENDPOINT_URL, {
    method: options.method ?? "POST",
    headers: {
      "content-type": "application/json",
      "sentry-hook-resource": options.resource ?? "event_alert",
      "sentry-hook-signature": signature,
    },
    body: options.method === "GET" || options.method === "OPTIONS" ? undefined : body,
  });
};

const env = {
  SENTRY_WEBHOOK_SECRET: SENTRY_SECRET,
  SLACK_SENTRY_WEBHOOK_URL: SLACK_WEBHOOK_URL,
};

const captureSlackPayload = async (payload = baseEvent) => {
  const slackFetch = vi.fn<typeof fetch>(async () => new Response("ok"));
  expect((await handleSentryWebhook(await makeRequest(payload), env, slackFetch)).status).toBe(204);
  expect(slackFetch).toHaveBeenCalledOnce();
  return JSON.parse(String(slackFetch.mock.calls[0]?.[1]?.body));
};

describe("Sentry Slack relay", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the Worker module fetch entry without treating ExecutionContext as fetch", async () => {
    const slackFetch = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", slackFetch);

    const response = await worker.fetch(await makeRequest(), env);

    expect(response.status).toBe(204);
    expect(slackFetch).toHaveBeenCalledOnce();
  });

  it("forwards only the allowlisted and sanitized issue fields", async () => {
    const payload = structuredClone(baseEvent);
    Object.assign(payload.data.event, {
      title: "TypeError: token=plain-secret <@U123>",
      metadata: {
        type: "TypeError",
        value: "user@example.com failed at https://api.example.test/path?token=secret",
      },
      user: { email: "private@example.com", ip_address: "192.0.2.1" },
      request: {
        data: { password: "body-secret" },
        headers: [["authorization", "Bearer header-secret"]],
      },
      exception: { values: [{ stacktrace: "full-stack-secret" }] },
      extra: { arbitrary: "extra-secret" },
    });
    const slackFetch = vi.fn(async () => new Response("ok", { status: 200 }));

    const response = await handleSentryWebhook(await makeRequest(payload), env, slackFetch);

    expect(response.status).toBe(204);
    expect(slackFetch).toHaveBeenCalledOnce();
    expect(slackFetch).toHaveBeenCalledWith(
      SLACK_WEBHOOK_URL,
      expect.objectContaining({ method: "POST" }),
    );

    const requestInit = slackFetch.mock.calls[0]?.[1];
    const slackPayload = JSON.parse(String(requestInit?.body));
    const serialized = JSON.stringify(slackPayload);
    expect(serialized).toContain("staging");
    expect(serialized).toContain("123456789");
    expect(serialized).toContain("2026-09-20 09:10:11 UTC");
    expect(serialized).toContain("token=[redacted]");
    expect(serialized).toContain("[redacted-email]");
    expect(serialized).toContain("[redacted-url]");
    expect(serialized).toContain("&lt;@U123&gt;");
    expect(serialized).toContain(
      "https://oioi-bwg.sentry.io/organizations/oioi-bwg/issues/123456789/?project=42",
    );
    expect(serialized).not.toContain("events/abcdef");
    for (const forbidden of [
      "plain-secret",
      "private@example.com",
      "192.0.2.1",
      "body-secret",
      "header-secret",
      "full-stack-secret",
      "extra-secret",
      "?query=sensitive",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("rejects missing or invalid authentication before delivery", async () => {
    const slackFetch = vi.fn();
    const missingSignature = await makeRequest(baseEvent, { signature: "missing" });
    missingSignature.headers.delete("sentry-hook-signature");
    const invalidSignature = await makeRequest(baseEvent, { secret: "wrong-secret" });

    expect((await handleSentryWebhook(missingSignature, env, slackFetch)).status).toBe(401);
    expect((await handleSentryWebhook(invalidSignature, env, slackFetch)).status).toBe(401);
    expect(slackFetch).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON, invalid issue fields, and non-alert resources", async () => {
    const slackFetch = vi.fn();
    const malformedJson = await makeRequest("{not-json");
    const invalidPayload = await makeRequest({ action: "triggered", data: { event: {} } });
    const wrongResource = await makeRequest(baseEvent, { resource: "issue" });

    expect((await handleSentryWebhook(malformedJson, env, slackFetch)).status).toBe(400);
    expect((await handleSentryWebhook(invalidPayload, env, slackFetch)).status).toBe(400);
    expect((await handleSentryWebhook(wrongResource, env, slackFetch)).status).toBe(400);
    expect(slackFetch).not.toHaveBeenCalled();
  });

  it("returns a safe gateway error when Slack rejects delivery", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const slackFetch = vi.fn(
      async () => new Response("invalid_payload: raw Slack detail", { status: 400 }),
    );

    const response = await handleSentryWebhook(await makeRequest(), env, slackFetch);

    expect(response.status).toBe(502);
    expect(await response.text()).toBe("Slack delivery failed");
    expect(consoleError).toHaveBeenCalledWith(
      JSON.stringify({ event: "sentry_slack_relay.delivery_failed", status: 400 }),
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("raw Slack detail");
  });

  it.each([undefined, "12", "1000001"])(
    "bounds streamed bytes with Content-Length %s",
    async (length) => {
      const cancel = vi.fn();
      let pulls = 0;
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pulls += 1;
            controller.enqueue(new Uint8Array(500_001));
          },
          cancel,
        },
        { highWaterMark: 0 },
      );
      const headers: Record<string, string> = {};
      if (length) headers["content-length"] = length;
      const request = new Request(ENDPOINT_URL, {
        method: "POST",
        body,
        headers,
        duplex: "half",
      } as RequestInit);
      const slackFetch = vi.fn();
      const response = await handleSentryWebhook(request, env, slackFetch);
      expect(response.status).toBe(413);
      expect(cancel).toHaveBeenCalledOnce();
      expect(pulls).toBe(length === "1000001" ? 0 : 2);
      expect(slackFetch).not.toHaveBeenCalled();
    },
  );

  it("accepts exactly one million signed bytes including multibyte text", async () => {
    const json = JSON.stringify({ ...baseEvent, ignored: "한글" });
    const body = json + " ".repeat(1_000_000 - new TextEncoder().encode(json).byteLength);
    const slackFetch = vi.fn(async () => new Response("ok"));
    expect((await handleSentryWebhook(await makeRequest(body), env, slackFetch)).status).toBe(204);
  });

  it("returns 400 for a broken body stream without forwarding raw error", async () => {
    const request = new Request(ENDPOINT_URL, {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.error(new Error("secret"));
        },
      }),
      duplex: "half",
    } as RequestInit);
    const response = await handleSentryWebhook(request, env, vi.fn());
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid request body");
  });

  it("allows POST only and does not add CORS handling", async () => {
    const slackFetch = vi.fn();
    const response = await handleSentryWebhook(
      new Request(ENDPOINT_URL, { method: "OPTIONS" }),
      env,
      slackFetch,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(slackFetch).not.toHaveBeenCalled();
  });
});

describe("Slack message layout", () => {
  it("puts the title first and keeps metadata, local time and the issue link compact", async () => {
    const payload = await captureSlackPayload();
    expect(payload.blocks.map((block: { type: string }) => block.type)).toEqual([
      "header",
      "context",
      "section",
    ]);
    expect(payload.blocks[0].text).toEqual({
      type: "plain_text",
      text: "TypeError: Failed to fetch",
      emoji: false,
    });
    expect(payload.blocks[1].elements[0].text).toBe("STAGING · 오류");
    expect(payload.blocks[2].text.text).toBe(
      "발생 <!date^1789895411^{date_num} {time_secs}|2026-09-20 09:10:11 UTC>",
    );
    expect(payload.blocks[2].accessory).toMatchObject({
      type: "button",
      text: { text: "Sentry에서 보기" },
      accessibility_label: "Sentry에서 오류 상세 보기",
      url: "https://oioi-bwg.sentry.io/organizations/oioi-bwg/issues/123456789/?project=42",
    });
    expect(payload.blocks.some((block: { fields?: unknown }) => block.fields)).toBe(false);
    expect(payload.text).toContain("[Sentry][staging][error] TypeError: Failed to fetch");
    expect(payload.text).toContain("발생 2026-09-20 09:10:11 UTC");
    expect(payload.text).toContain(payload.blocks[2].accessory.url);
    expect(payload).toMatchObject({ unfurl_links: false, unfurl_media: false });
  });

  it.each([
    ["TypeError: Failed to fetch", "Failed to fetch", 0],
    ["Failed to fetch", "Failed to fetch", 0],
    ["TypeError", "A separate diagnostic message", 1],
    ["TypeError", "", 0],
  ] as const)(
    "only adds a body when it contributes information: %s",
    async (title, message, count) => {
      const event = structuredClone(baseEvent);
      event.data.event.title = title;
      event.data.event.metadata.value = message;
      const payload = await captureSlackPayload(event);
      const body = payload.blocks.filter(
        (block: { type: string; text?: { type: string } }) =>
          block.type === "section" && block.text?.type === "plain_text",
      );
      expect(body).toHaveLength(count);
      if (count) expect(body[0].text.text).toBe(message);
    },
  );

  it.each(["가".repeat(150), "가".repeat(151), "😀".repeat(120)])(
    "fits the header limit without breaking Unicode or losing the full fallback title",
    async (title) => {
      const event = structuredClone(baseEvent);
      event.data.event.title = title;
      const payload = await captureSlackPayload(event);
      const heading = payload.blocks[0].text.text;
      expect(heading.length).toBeLessThanOrEqual(150);
      expect(() => encodeURIComponent(heading)).not.toThrow();
      expect(payload.text).toContain(title);
      if (title.length <= 150) expect(heading).toBe(title);
      else expect(heading).toMatch(/…$/);
    },
  );

  it("keeps unknown environment and default severity visible", async () => {
    const event = structuredClone(baseEvent);
    event.data.event.tags = [["environment", "unrecognized"]];
    event.data.event.level = "unrecognized";
    const payload = await captureSlackPayload(event);
    expect(payload.blocks[1].elements[0].text).toBe("UNKNOWN · 오류");
  });

  it("keeps a truncated title available without repeating it in the accessible fallback", async () => {
    const event = structuredClone(baseEvent);
    const title = "가".repeat(151);
    event.data.event.title = title;
    event.data.event.metadata.value = title;
    const payload = await captureSlackPayload(event);
    expect(payload.blocks[2].text).toMatchObject({ type: "plain_text", text: title });
    expect(payload.text.split(title)).toHaveLength(2);
  });
});
