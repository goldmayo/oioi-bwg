import "server-only";

import { type ClientRequest, type IncomingMessage, request } from "node:http";

import {
  waveformEnqueueAckSchema,
  type WaveformEnqueueOutcome,
  type WaveformQueuePayload,
  waveformQueuePayloadSchema,
} from "@oioi-bwg/contracts/waveform";

import { waveformRunnerConfig as config } from "./runner-config";

let inFlight = 0;

/** 새 Job의 접수 소유자만 호출한다. 전송 재시도·Job 상태 변경·OCI 호출은 하지 않는다. */
export async function enqueueWaveform(
  payload: WaveformQueuePayload,
): Promise<WaveformEnqueueOutcome> {
  const input = waveformQueuePayloadSchema.parse(payload);
  // 소켓을 열기 전 거절하며 자체 대기열을 만들지 않는다.
  if (inFlight >= config.maxInFlight) return "NOT_ENQUEUED";
  inFlight++;
  return new Promise((resolve) => {
    let settled = false;
    let outgoing: ClientRequest | undefined;
    let incoming: IncomingMessage | undefined;
    const finish = (outcome: WaveformEnqueueOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      incoming?.destroy();
      outgoing?.destroy();
      inFlight--;
      resolve(outcome);
    };
    // idle timeout과 달리 연결·header·body 전체에 하나의 절대 기한을 적용한다.
    const timer = setTimeout(() => finish("UNCONFIRMED"), config.deadlineMs);
    try {
      const body = JSON.stringify(input);
      outgoing = request(
        {
          socketPath: config.socketPath,
          method: "POST",
          path: "/enqueue",
          agent: false,
          maxHeaderSize: config.maxResponseBytes,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            Connection: "close",
          },
        },
        (response) => {
          incoming = response;
          if (
            settled ||
            response.statusCode !== 200 ||
            response.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
              "application/json" ||
            response.headers["content-encoding"]
          ) {
            response.destroy();
            finish("UNCONFIRMED");
            return;
          }
          let length = 0;
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => {
            if (settled) return;
            length += chunk.length;
            if (length > config.maxResponseBytes) finish("UNCONFIRMED");
            else chunks.push(chunk);
          });
          response.once("end", () => {
            if (settled) return;
            try {
              const ack = waveformEnqueueAckSchema.safeParse(
                JSON.parse(Buffer.concat(chunks, length).toString("utf8")) as unknown,
              );
              finish(
                ack.success && ack.data.jobId === input.jobId ? ack.data.outcome : "UNCONFIRMED",
              );
            } catch {
              finish("UNCONFIRMED");
            }
          });
          response.once("error", () => finish("UNCONFIRMED"));
          response.once("aborted", () => finish("UNCONFIRMED"));
        },
      );
      outgoing.once("error", () => finish("UNCONFIRMED"));
      outgoing.end(body);
    } catch {
      finish("UNCONFIRMED");
    }
  });
}
