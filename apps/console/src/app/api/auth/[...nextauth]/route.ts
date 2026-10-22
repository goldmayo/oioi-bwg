import { type NextRequest } from "next/server";

import { toErrorResponse } from "@/server/http/api-response";
import { assertConsoleHost, assertConsoleOrigin } from "@/server/http/console-origin";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

import { handlers } from "@/auth";

export async function GET(request: NextRequest) {
  try {
    assertConsoleHost(request.headers);
    return await handlers.GET(request);
  } catch (error) {
    return toErrorResponse(error, {
      route: "/api/auth/[...nextauth]",
      ...readRequestObservation(request.headers, "/api/auth/[...nextauth]"),
    });
  }
}
export async function POST(request: NextRequest) {
  try {
    assertConsoleOrigin(request.headers);
    return await handlers.POST(request);
  } catch (error) {
    return toErrorResponse(error, {
      route: "/api/auth/[...nextauth]",
      ...readRequestObservation(request.headers, "/api/auth/[...nextauth]"),
    });
  }
}
