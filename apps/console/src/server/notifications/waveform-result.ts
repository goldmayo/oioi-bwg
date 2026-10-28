import "server-only";

import { waveformTerminalSchema } from "@oioi-bwg/contracts/waveform";
import { completeWaveformJob } from "@oioi-bwg/server/services/waveform-service";
import { z } from "zod";

import { wakeNotificationDispatcher } from "./dispatcher";
/** 향후 인증된 Runner HTTP adapter가 호출한다. 외부 endpoint는 Runner 관문 전까지 열지 않는다. */
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
