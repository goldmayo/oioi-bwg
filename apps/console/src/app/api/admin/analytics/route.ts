import { analyticsInputSchema, analyticsReportSchema } from "@oioi-bwg/contracts/analytics";
import { AppError } from "@oioi-bwg/server/errors/app-error";

import { getAnalyticsReport } from "@/server/analytics/ga4";
import { getRequestAuthorization, requireUser } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

export async function GET(request: Request) {
  let authorization;
  try {
    authorization = await getRequestAuthorization();
    requireUser(authorization.context);
    if (authorization.context.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
    const input = analyticsInputSchema
      .refine(
        ({ to }) =>
          to <
          new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", dateStyle: "short" }).format(
            new Date(),
          ),
        { message: "종료일은 어제까지 선택할 수 있습니다." },
      )
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    return jsonResponse(
      analyticsReportSchema,
      await getAnalyticsReport(authorization.context, input, request.signal),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const response = toErrorResponse(error, {
      route: "/api/admin/analytics",
      ...readRequestObservation(request.headers, "/api/admin/analytics"),
      authorization,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
