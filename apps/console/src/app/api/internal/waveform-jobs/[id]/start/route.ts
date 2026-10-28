import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { waveformStartAckSchema, waveformStartInputSchema } from "@oioi-bwg/contracts/waveform";
import { startWaveformJob } from "@oioi-bwg/server/services/waveform-service";

import { jsonResponse } from "@/server/http/api-response";
import { readWaveformRunnerBody, waveformRunnerRoute } from "@/server/http/waveform-runner-route";

export const runtime = "nodejs";
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return waveformRunnerRoute(request, "/api/internal/waveform-jobs/[id]/start", async () => {
    const id = entityIdSchema.parse((await context.params).id);
    const input = waveformStartInputSchema
      .refine((value) => value.jobId === id, { message: "작업 식별자가 일치하지 않습니다." })
      .parse(await readWaveformRunnerBody(request, 1024));
    return jsonResponse(waveformStartAckSchema, await startWaveformJob(input));
  });
}
