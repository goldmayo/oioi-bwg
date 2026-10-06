import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";

import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";

/** 현재 사용자의 직렬화된 CASL rules를 조회하고 응답 계약으로 검증한다. */
export async function getCurrentAbility(signal?: AbortSignal) {
  const data = await http.get("/api/auth/ability", { signal });
  return parseClientResponse(serializedAbilityResponseSchema, data);
}
