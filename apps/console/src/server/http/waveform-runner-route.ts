import "server-only";

import { timingSafeEqual } from "node:crypto";

import { apiErrorResponseSchema } from "@oioi-bwg/contracts/error";
import { AppError } from "@oioi-bwg/server/errors/app-error";

import { jsonResponse, toErrorResponse } from "./api-response";

class RunnerBodyError extends Error {
  constructor(readonly status: number) {
    super("파형 결과 요청 본문을 확인해 주세요.");
  }
}

/** 사용자 세션과 분리된 명시적 Runner 경로에만 적용한다. 기본 상태는 비활성이다. */
export async function waveformRunnerRoute(
  request: Request,
  route: string,
  action: () => Promise<Response>,
) {
  let response: Response;
  try {
    if (process.env.CONSOLE_WAVEFORM_RUNNER_ENABLED !== "true") throw new AppError("FORBIDDEN");
    const token = process.env.CONSOLE_WAVEFORM_RUNNER_TOKEN ?? "";
    if (!/^[a-f0-9]{64}$/.test(token) || token === process.env.CONSOLE_AUTH_SECRET)
      throw new Error("Invalid waveform Runner configuration");
    const supplied = /^Bearer ([a-f0-9]{64})$/i.exec(
      request.headers.get("authorization") ?? "",
    )?.[1];
    if (!supplied || !timingSafeEqual(Buffer.from(token), Buffer.from(supplied)))
      throw new AppError("UNAUTHENTICATED");
    if (request.headers.has("origin")) throw new AppError("FORBIDDEN");
    response = await action();
  } catch (error) {
    response =
      error instanceof RunnerBodyError
        ? jsonResponse(
            apiErrorResponseSchema,
            { code: "VALIDATION_ERROR", message: error.message },
            { status: error.status },
          )
        : toErrorResponse(error, { route });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** 인증 후에만 읽으며 Content-Length와 무관하게 실제 byte 수와 경과 시간을 제한한다. */
export async function readWaveformRunnerBody(
  request: Request,
  maximum = 4 * 1024 * 1024,
): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    throw new RunnerBodyError(415);
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum))
    throw new RunnerBodyError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new RunnerBodyError(400);
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RunnerBodyError(408)), 10_000);
  });
  try {
    const bytes = Buffer.alloc(maximum);
    let length = 0;
    while (true) {
      const next = await Promise.race([reader.read(), deadline]);
      if (next.done) break;
      if (length + next.value.byteLength > maximum) throw new RunnerBodyError(413);
      bytes.set(next.value, length);
      length += next.value.byteLength;
    }
    return JSON.parse(bytes.subarray(0, length).toString("utf8")) as unknown;
  } catch (error) {
    throw error instanceof RunnerBodyError ? error : new RunnerBodyError(400);
  } finally {
    clearTimeout(timer!);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
