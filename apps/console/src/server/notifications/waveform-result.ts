import "server-only";

import { waveformTerminalSchema } from "@oioi-bwg/contracts/waveform";
import { completeWaveformJob } from "@oioi-bwg/server/services/waveform-service";

import { wakeNotificationDispatcher } from "./dispatcher";
/** 향후 인증된 Runner HTTP adapter가 호출한다. 외부 endpoint는 Runner 관문 전까지 열지 않는다. */
export async function acceptWaveformResult(value: unknown) {
  const result = await completeWaveformJob(waveformTerminalSchema.parse(value));
  if (result.applied) wakeNotificationDispatcher();
  return result;
}
