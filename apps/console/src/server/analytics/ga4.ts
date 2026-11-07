import "server-only";

import { type AnalyticsInput, type AnalyticsReport } from "@oioi-bwg/contracts/analytics";
import { type RequestContext, requireUser } from "@oioi-bwg/server/auth/request-context";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { GoogleAuth } from "google-auth-library";
import { z } from "zod";

import { getAnalyticsConfig } from "@/shared/config/analytics";

const dimensions = {
  summary: undefined,
  trend: "date",
  pages: "pageTitle",
  channels: "sessionDefaultChannelGroup",
  sources: "sessionSourceMedium",
  devices: "deviceCategory",
  browsers: "browser",
};
const metricNames = ["activeUsers", "sessions", "screenPageViews"];
const valueSchema = z.object({
  value: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative()),
});
const googleReportSchema = z.object({
  rows: z
    .array(
      z.object({
        dimensionValues: z.array(z.object({ value: z.string() })).optional(),
        metricValues: z.array(valueSchema).length(3),
      }),
    )
    .default([]),
  rowCount: z.number().int().nonnegative().optional(),
  metadata: z.object({
    timeZone: z.string(),
    subjectToThresholding: z.boolean().optional(),
    samplingMetadatas: z.array(z.unknown()).optional(),
  }),
});
let authentication: { identity: string; auth: GoogleAuth } | undefined;

async function getToken(config: NonNullable<ReturnType<typeof getAnalyticsConfig>>) {
  try {
    const identity = config.json ?? config.file!;
    if (authentication?.identity !== identity) {
      const credentials = config.json
        ? (JSON.parse(config.json) as Record<string, unknown>)
        : undefined;
      authentication = {
        identity,
        auth: new GoogleAuth({
          credentials,
          keyFilename: config.file,
          scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
          clientOptions: { transporterOptions: { timeout: 8_000, retry: false } },
        }),
      };
    }
    const token = await authentication.auth.getAccessToken();
    if (!token) throw new Error("Missing access token");
    return token;
  } catch {
    // Google 인증 예외에는 키와 request config가 포함될 수 있어 원본을 전달하지 않는다.
    throw new AppError("ANALYTICS_UNAVAILABLE");
  }
}

function reportRequest(input: AnalyticsInput, total: boolean) {
  const dimension = total ? undefined : dimensions[input.report];
  const rankingMetrics: Partial<Record<AnalyticsInput["report"], string>> = {
    pages: "screenPageViews",
    channels: "sessions",
    sources: "sessions",
  };
  return {
    dateRanges: [{ startDate: input.from, endDate: input.to }],
    dimensions: dimension ? [{ name: dimension }] : [],
    metrics: metricNames.map((name) => ({ name })),
    limit: input.report === "trend" ? "366" : "20",
    orderBys:
      input.report === "trend" && !total
        ? [{ dimension: { dimensionName: "date" } }]
        : [{ metric: { metricName: rankingMetrics[input.report] ?? "activeUsers" }, desc: true }],
  };
}

async function runReports(
  propertyId: string,
  token: string,
  input: AnalyticsInput,
  signal: AbortSignal,
) {
  const requests =
    input.report === "summary"
      ? [reportRequest(input, true)]
      : [reportRequest(input, false), reportRequest(input, true)];
  let response: Response;
  try {
    response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:batchRunReports`,
      {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      },
    );
  } catch {
    throw new AppError("ANALYTICS_UNAVAILABLE");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new AppError(
      response.status === 429 ? "ANALYTICS_RATE_LIMITED" : "ANALYTICS_UNAVAILABLE",
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  const parsed = z
    .object({ reports: z.array(googleReportSchema).length(requests.length) })
    .safeParse(payload);
  if (
    !parsed.success ||
    parsed.data.reports.some((report) => report.metadata.timeZone !== "Asia/Seoul")
  )
    throw new Error("Invalid GA4 reporting response");
  return parsed.data.reports;
}

function metrics(values: { value: number }[] | undefined) {
  return {
    users: values?.[0]?.value ?? 0,
    sessions: values?.[1]?.value ?? 0,
    views: values?.[2]?.value ?? 0,
  };
}

export async function getAnalyticsReport(
  ctx: RequestContext,
  input: AnalyticsInput,
  signal: AbortSignal,
): Promise<AnalyticsReport> {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  const config = getAnalyticsConfig();
  if (!config) throw new AppError("ANALYTICS_NOT_CONFIGURED");
  const token = await getToken(config);
  const reports = await runReports(config.propertyId, token, input, signal);
  const report = reports[0];
  const totals = reports.at(-1)!;
  return {
    report: input.report,
    from: input.from,
    to: input.to,
    fetchedAt: new Date().toISOString(),
    timeZone: report.metadata.timeZone,
    totals: metrics(totals.rows[0]?.metricValues),
    rows:
      input.report === "summary"
        ? []
        : report.rows.map((row) => ({
            label: row.dimensionValues?.[0]?.value ?? "(not set)",
            ...metrics(row.metricValues),
          })),
    thresholded: Boolean(
      report.metadata.subjectToThresholding || totals.metadata.subjectToThresholding,
    ),
    sampled: Boolean(
      report.metadata.samplingMetadatas?.length || totals.metadata.samplingMetadatas?.length,
    ),
    truncated: (report.rowCount ?? 0) > report.rows.length,
  };
}
