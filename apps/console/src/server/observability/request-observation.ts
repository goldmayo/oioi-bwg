import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

/** Next 요청 범위가 없으면 연결 불가로 남긴다. 전역 fallback ID는 만들지 않는다. */
export const getRequestObservation = cache(async () => {
  try {
    return readRequestObservation(await headers());
  } catch {
    return {};
  }
});
