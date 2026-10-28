import "server-only";

import { waveformTerminalSchema } from "@oioi-bwg/contracts/waveform";
import { completeWaveformJob } from "@oioi-bwg/server/services/waveform-service";
import { z } from "zod";

import { wakeNotificationDispatcher } from "./dispatcher";
/** 인증된 Runner 결과와 Console의 확정 미전달만 반영한다. 각 HTTP 경계는 기본 비활성이다. */
export async function acceptWaveformResult(value: unknown, expectedJobId?: string) {
  const input = waveformTerminalSchema.parse(value);
  if (expectedJobId !== undefined && input.jobId !== expectedJobId)
    throw new z.ZodError([
      { code: "custom", path: ["jobId"], message: "작업 식별자가 일치하지 않습니다." },
    ]);
  const result = await completeWaveformJob(input);
  if (result.applied) wakeNotificationDispatcher();
  return result;
}
