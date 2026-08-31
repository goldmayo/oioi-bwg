import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";
import { serializedAbilityResponseSchema } from "@/shared/contracts/authorization";

/** 현재 사용자의 직렬화된 CASL rules를 조회하고 응답 계약으로 검증한다. */
export async function getCurrentAbility(signal?: AbortSignal) {
  const data = await http.get("/api/auth/ability", { signal });
  return parseClientResponse(serializedAbilityResponseSchema, data);
}
