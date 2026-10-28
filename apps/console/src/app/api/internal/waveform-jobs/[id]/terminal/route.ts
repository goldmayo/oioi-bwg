import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { waveformTerminalAckSchema } from "@oioi-bwg/contracts/waveform";

import { jsonResponse } from "@/server/http/api-response";
import { readWaveformRunnerBody, waveformRunnerRoute } from "@/server/http/waveform-runner-route";
import { acceptWaveformResult } from "@/server/notifications/waveform-result";

export const runtime = "nodejs";
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return waveformRunnerRoute(request, "/api/internal/waveform-jobs/[id]/terminal", async () => {
    const id = entityIdSchema.parse((await context.params).id);
    return jsonResponse(
      waveformTerminalAckSchema,
      await acceptWaveformResult(await readWaveformRunnerBody(request), id),
    );
  });
}
