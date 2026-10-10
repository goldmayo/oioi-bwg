import { type NextRequest } from "next/server";

import { toErrorResponse } from "@/server/http/api-response";
import { assertConsoleOrigin } from "@/server/http/console-origin";

import { handlers } from "@/auth";

export const GET = handlers.GET;
export async function POST(request: NextRequest) {
  try {
    assertConsoleOrigin(request.headers);
    return await handlers.POST(request);
  } catch (error) {
    return toErrorResponse(error);
  }
}
