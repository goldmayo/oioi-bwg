import "server-only";

import { timingSafeEqual } from "node:crypto";

import { AppError } from "@oioi-bwg/server/errors/app-error";

import { toErrorResponse } from "./api-response";

export { readBoundedJsonBody as readWaveformRunnerBody } from "./bounded-json-body";

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
    response = toErrorResponse(error, { route });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
