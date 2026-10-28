import { rmSync } from "node:fs";
import { createServer, type RequestListener, type Server, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { dirname } from "node:path";

import type { WaveformQueuePayload } from "@oioi-bwg/contracts/waveform";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("./runner-config", async (original) => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const actual = await original<typeof import("./runner-config")>();
  return {
    waveformRunnerConfig: {
      ...actual.waveformRunnerConfig,
      socketPath: join(mkdtempSync(join(tmpdir(), "wfr-")), "runner.sock"),
    },
  };
});
import { enqueueWaveform } from "./enqueue";
import { waveformRunnerConfig as config } from "./runner-config";

const payload = {
  jobId: "019a0170-0000-7000-8000-000000000001",
  songId: "019a0170-0000-7000-8000-000000000002",
  videoId: "abcdefghijk",
};
let server: Server;
let handler: RequestListener;
let bodies: unknown[];
const sockets = new Set<Socket>();
const ack = (outcome = "ENQUEUED") => JSON.stringify({ jobId: payload.jobId, outcome });
beforeEach(async () => {
  bodies = [];
  handler = (_, res) => res.end(ack());
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      bodies.push(JSON.parse(body));
      expect(req.method).toBe("POST");
      expect(req.url).toBe("/enqueue");
      expect(req.headers["content-type"]).toBe("application/json");
      expect(req.headers.authorization).toBeUndefined();
      res.setHeader("Content-Type", "application/json");
      handler(req, res);
    });
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(config.socketPath, resolve));
});
afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
afterAll(() => rmSync(dirname(config.socketPath), { recursive: true, force: true }));

it.each(["ENQUEUED", "UNCONFIRMED", "NOT_ENQUEUED"])(
  "세 식별자만 전송하고 일치하는 %s ACK를 소비한다",
  async (outcome) => {
    handler = (_, res) => res.end(ack(outcome));
    expect(await enqueueWaveform(payload)).toBe(outcome);
    expect(bodies).toEqual([payload]);
  },
);
it.each([
  { status: 503, body: ack("NOT_ENQUEUED") },
  { status: 307, body: ack("NOT_ENQUEUED") },
  { status: 200, body: "{" },
  { status: 200, body: JSON.stringify({ ...payload, outcome: "ENQUEUED" }) },
  { status: 200, body: JSON.stringify({ jobId: payload.songId, outcome: "NOT_ENQUEUED" }) },
  { status: 200, body: "x".repeat(config.maxResponseBytes + 1) },
])("부적합 응답 $status는 실패 확정이나 재전송으로 바꾸지 않는다", async ({ status, body }) => {
  handler = (_, res) => {
    res.statusCode = status;
    res.setHeader("Location", "http://127.0.0.1:1/forbidden");
    res.end(body);
  };
  expect(await enqueueWaveform(payload)).toBe("UNCONFIRMED");
  expect(bodies).toHaveLength(1);
});
it("임의 실행 필드는 소켓을 열기 전에 거절한다", async () => {
  await expect(
    enqueueWaveform({ ...payload, command: ["sh"] } as WaveformQueuePayload),
  ).rejects.toThrow();
  expect(bodies).toHaveLength(0);
});
it.each([
  ["Content-Type", "text/plain"],
  ["Content-Encoding", "gzip"],
  ["X-Padding", "x".repeat(config.maxResponseBytes + 1)],
])("부적합 응답 header %s도 확인 중으로 처리한다", async (name, value) => {
  handler = (_, res) => {
    res.setHeader(name, value);
    res.end(ack("NOT_ENQUEUED"));
  };
  expect(await enqueueWaveform(payload)).toBe("UNCONFIRMED");
  expect(bodies).toHaveLength(1);
});
it("접수 뒤 응답 유실과 연결 실패 모두 확인 중으로 남긴다", async () => {
  handler = (req) => req.socket.destroy();
  expect(await enqueueWaveform(payload)).toBe("UNCONFIRMED");
  expect(bodies).toHaveLength(1);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  expect(await enqueueWaveform(payload)).toBe("UNCONFIRMED");
});
it("응답이 계속 흘러도 절대 기한에 연결을 종료한다", async () => {
  handler = (_, res) => {
    const interval = setInterval(() => res.write(" "), 25);
    res.once("close", () => clearInterval(interval));
  };
  const start = performance.now();
  expect(await enqueueWaveform(payload)).toBe("UNCONFIRMED");
  expect(performance.now() - start).toBeGreaterThanOrEqual(config.deadlineMs - 100);
  expect(performance.now() - start).toBeLessThan(config.deadlineMs + 2000);
  expect(bodies).toHaveLength(1);
});
it("8개 호출 중 추가 호출은 전송 전에 거절하고 대기열을 만들지 않는다", async () => {
  const responses: ServerResponse[] = [];
  handler = (_, res) => {
    responses.push(res);
  };
  const pending = Array.from({ length: config.maxInFlight }, () => enqueueWaveform(payload));
  await vi.waitFor(() => expect(responses).toHaveLength(config.maxInFlight));
  expect(await enqueueWaveform(payload)).toBe("NOT_ENQUEUED");
  expect(bodies).toHaveLength(config.maxInFlight);
  for (const response of responses) response.end(ack());
  expect(await Promise.all(pending)).toEqual(Array(config.maxInFlight).fill("ENQUEUED"));
  handler = (_, res) => res.end(ack());
  expect(await enqueueWaveform(payload)).toBe("ENQUEUED");
});
