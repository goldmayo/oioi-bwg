interface Env {
  SENTRY_WEBHOOK_SECRET: string;
  SLACK_SENTRY_WEBHOOK_URL: string;
}

interface RelayEvent {
  environment: "local" | "staging" | "production" | "unknown";
  issueId: string;
  issueUrl: string;
  level: "fatal" | "error" | "warning" | "info" | "debug";
  message: string;
  occurredAt: string;
  projectId: string;
  title: string;
}

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const ENDPOINT_PATH = "/webhooks/sentry";
const MAX_BODY_BYTES = 1_000_000;
const SLACK_TIMEOUT_MS = 800;
const textEncoder = new TextEncoder();

const textResponse = (status: number, body: string, headers?: HeadersInit) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...headers },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asBoundedIdentifier = (value: unknown, maxLength = 80): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const candidate = String(value);
  return candidate.length > 0 &&
    candidate.length <= maxLength &&
    /^[A-Za-z0-9._-]+$/.test(candidate)
    ? candidate
    : null;
};

const redactDiagnosticText = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;

  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/[^\s<>"']+/gi, "[redacted-url]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(
      /\b(authorization|cookie|password|passwd|token|secret|api[_-]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1=[redacted]",
    )
    .replace(/\beyJ[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]{10,}){1,2}\b/g, "[redacted-token]")
    .replace(/\b[A-Fa-f0-9]{40,}\b/g, "[redacted-token]")
    .trim();

  return sanitized.length > 0 ? sanitized.slice(0, 240) : fallback;
};

const escapeSlackMrkdwn = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const readEnvironment = (event: Record<string, unknown>): RelayEvent["environment"] => {
  const direct = event.environment;
  if (direct === "local" || direct === "staging" || direct === "production") return direct;

  if (Array.isArray(event.tags)) {
    const environmentTag = event.tags.find(
      (tag): tag is [string, unknown] => Array.isArray(tag) && tag[0] === "environment",
    );
    const value = environmentTag?.[1];
    if (value === "local" || value === "staging" || value === "production") return value;
  }

  return "unknown";
};

const readLevel = (value: unknown): RelayEvent["level"] => {
  if (
    value === "fatal" ||
    value === "error" ||
    value === "warning" ||
    value === "info" ||
    value === "debug"
  ) {
    return value;
  }
  return "error";
};

const readOccurredAt = (event: Record<string, unknown>): string | null => {
  const candidates = [event.datetime, event.timestamp, event.received];
  for (const candidate of candidates) {
    const date =
      typeof candidate === "number"
        ? new Date(candidate * 1_000)
        : typeof candidate === "string"
          ? new Date(candidate)
          : null;
    if (date && !Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
};

const readSentryIssueUrl = (value: unknown, issueId: string, projectId: string): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const isSentryHost = url.hostname === "sentry.io" || url.hostname.endsWith(".sentry.io");
    const pathParts = url.pathname.split("/").filter(Boolean);
    const issueIndex = pathParts.indexOf("issues");
    if (
      url.protocol !== "https:" ||
      !isSentryHost ||
      issueIndex < 0 ||
      pathParts[issueIndex + 1] !== issueId
    )
      return null;
    url.username = "";
    url.password = "";
    url.pathname = `/${pathParts.slice(0, issueIndex + 2).join("/")}/`;
    url.search = "";
    url.searchParams.set("project", projectId);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

const parseRelayEvent = (rawBody: string): RelayEvent | null => {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isRecord(payload) || payload.action !== "triggered" || !isRecord(payload.data)) return null;
  if (!isRecord(payload.data.event)) return null;

  const event = payload.data.event;
  const issueId = asBoundedIdentifier(event.issue_id);
  const projectId = asBoundedIdentifier(event.project);
  const issueUrl =
    issueId && projectId ? readSentryIssueUrl(event.web_url, issueId, projectId) : null;
  const occurredAt = readOccurredAt(event);
  if (!issueId || !projectId || !issueUrl || !occurredAt || typeof event.title !== "string")
    return null;

  const metadata = isRecord(event.metadata) ? event.metadata : null;
  const title = redactDiagnosticText(event.title, "Unexpected Sentry issue");
  const message = redactDiagnosticText(metadata?.value ?? event.message, title);

  return {
    environment: readEnvironment(event),
    issueId,
    issueUrl,
    level: readLevel(event.level),
    message,
    occurredAt,
    projectId,
    title,
  };
};

const decodeHex = (value: string): Uint8Array<ArrayBuffer> | null => {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const verifySignature = async (
  rawBody: Uint8Array<ArrayBuffer>,
  signature: string | null,
  secret: string,
) => {
  const signatureBytes = signature ? decodeHex(signature) : null;
  if (!signatureBytes || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, signatureBytes, rawBody);
};

const buildSlackPayload = (event: RelayEvent) => {
  const title = escapeSlackMrkdwn(event.title);
  const message = escapeSlackMrkdwn(event.message);
  const environment = escapeSlackMrkdwn(event.environment);
  const level = escapeSlackMrkdwn(event.level);
  const projectId = escapeSlackMrkdwn(event.projectId);
  const issueId = escapeSlackMrkdwn(event.issueId);
  const occurredAt = escapeSlackMrkdwn(event.occurredAt);

  return {
    text: `[Sentry][${event.environment}] ${escapeSlackMrkdwn(event.title)}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "Sentry new issue", emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: `*Title*\n${title}` } },
      { type: "section", text: { type: "mrkdwn", text: `*Message*\n${message}` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Environment*\n${environment}` },
          { type: "mrkdwn", text: `*Level*\n${level}` },
          { type: "mrkdwn", text: `*Project*\n${projectId}` },
          { type: "mrkdwn", text: `*Issue*\n${issueId}` },
          { type: "mrkdwn", text: `*Occurred at*\n${occurredAt}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open in Sentry" },
            url: event.issueUrl,
            action_id: "open_sentry_issue",
          },
        ],
      },
    ],
  };
};

const readSlackWebhookUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    const validHost = url.hostname === "hooks.slack.com" || url.hostname === "hooks.slack-gov.com";
    return url.protocol === "https:" &&
      validHost &&
      url.pathname.startsWith("/services/") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

// Count bytes before retaining chunks; Content-Length is only an early rejection hint.
const readBoundedBody = async (request: Request): Promise<Uint8Array<ArrayBuffer> | Response> => {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    await request.body?.cancel().catch(() => undefined);
    return textResponse(413, "Payload too large");
  }
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const bytes = new Uint8Array(MAX_BODY_BYTES);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return bytes.subarray(0, size);
      if (value.byteLength > MAX_BODY_BYTES - size) {
        await reader.cancel().catch(() => undefined);
        return textResponse(413, "Payload too large");
      }
      bytes.set(value, size);
      size += value.byteLength;
    }
  } catch {
    return textResponse(400, "Invalid request body");
  } finally {
    reader.releaseLock();
  }
};

export const handleSentryWebhook = async (
  request: Request,
  env: Env,
  fetchImpl: Fetch = fetch,
): Promise<Response> => {
  const url = new URL(request.url);
  if (url.pathname !== ENDPOINT_PATH) return textResponse(404, "Not found");
  if (request.method !== "POST") return textResponse(405, "Method not allowed", { allow: "POST" });
  if (!env.SENTRY_WEBHOOK_SECRET || !env.SLACK_SENTRY_WEBHOOK_URL) {
    console.error(JSON.stringify({ event: "sentry_slack_relay.configuration_error" }));
    return textResponse(500, "Relay configuration error");
  }

  const rawBody = await readBoundedBody(request);
  if (rawBody instanceof Response) return rawBody;

  const authenticated = await verifySignature(
    rawBody,
    request.headers.get("sentry-hook-signature"),
    env.SENTRY_WEBHOOK_SECRET,
  );
  if (!authenticated) return textResponse(401, "Unauthorized");
  if (request.headers.get("sentry-hook-resource") !== "event_alert") {
    return textResponse(400, "Unsupported Sentry resource");
  }

  const event = parseRelayEvent(new TextDecoder().decode(rawBody));
  if (!event) return textResponse(400, "Invalid Sentry payload");
  const slackWebhookUrl = readSlackWebhookUrl(env.SLACK_SENTRY_WEBHOOK_URL);
  if (!slackWebhookUrl) {
    console.error(JSON.stringify({ event: "sentry_slack_relay.configuration_error" }));
    return textResponse(500, "Relay configuration error");
  }

  try {
    const slackResponse = await fetchImpl(slackWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSlackPayload(event)),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    if (!slackResponse.ok) {
      console.error(
        JSON.stringify({
          event: "sentry_slack_relay.delivery_failed",
          status: slackResponse.status,
        }),
      );
      return textResponse(502, "Slack delivery failed");
    }
  } catch {
    console.error(JSON.stringify({ event: "sentry_slack_relay.delivery_failed" }));
    return textResponse(502, "Slack delivery failed");
  }

  return new Response(null, { status: 204 });
};

const worker = {
  fetch: (request: Request, env: Env) => handleSentryWebhook(request, env),
};

export default worker;
