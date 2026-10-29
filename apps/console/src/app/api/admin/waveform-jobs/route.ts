import { waveformAcceptedSchema, waveformRequestSchema } from "@oioi-bwg/contracts/waveform";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { requestWaveformJob } from "@oioi-bwg/server/services/waveform-service";

import {
  getRequestAuthorization,
  type RequestAuthorization,
  requireUser,
} from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";
import { acceptWaveformResult } from "@/server/notifications/waveform-result";
import { enqueueWaveform } from "@/server/waveform/enqueue";

import { getWaveformGenerationConfig } from "@/shared/config/console-runtime";
import { readRequestObservation } from "@/shared/lib/observability-correlation";

export async function POST(request: Request) {
  let authorization: RequestAuthorization | undefined;
  try {
    const config = getWaveformGenerationConfig();
    if (!config.enabled) throw new AppError("FORBIDDEN");
    authorization = await getRequestAuthorization();
    requireUser(authorization.context);
    if (authorization.context.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
    const { songId } = await parseJsonRequest(request, waveformRequestSchema);
    const { job, created } = await requestWaveformJob(
      authorization.context,
      songId,
      config.allowedVideoIds,
    );
    if (created) {
      const outcome = await enqueueWaveform({
        jobId: job.id,
        songId: job.songId,
        videoId: job.videoId,
      });
      if (outcome === "NOT_ENQUEUED") {
        const ack = await acceptWaveformResult({
          jobId: job.id,
          attemptId: null,
          status: "FAILED",
          errorCode: "ENQUEUE_FAILED",
        });
        if (ack.applied) throw new AppError("ENQUEUE_FAILED");
      }
    }
    return jsonResponse(
      waveformAcceptedSchema,
      { jobId: job.id },
      {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const response = toErrorResponse(error, {
      route: "/api/admin/waveform-jobs",
      ...readRequestObservation(request.headers, "/api/admin/waveform-jobs"),
      authorization,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
