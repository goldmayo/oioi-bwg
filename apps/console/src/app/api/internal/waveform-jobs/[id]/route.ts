import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { waveformRunnerJobSchema } from "@oioi-bwg/contracts/waveform";
import { getRunnerWaveformJob } from "@oioi-bwg/server/services/waveform-service";

import { jsonResponse } from "@/server/http/api-response";
import { waveformRunnerRoute } from "@/server/http/waveform-runner-route";

export const runtime = "nodejs";
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return waveformRunnerRoute(request, "/api/internal/waveform-jobs/[id]", async () =>
    jsonResponse(
      waveformRunnerJobSchema,
      await getRunnerWaveformJob(entityIdSchema.parse((await context.params).id)),
    ),
  );
}
