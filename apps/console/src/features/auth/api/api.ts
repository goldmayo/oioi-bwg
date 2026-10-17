import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import {
  type ConsoleMfaConfirm,
  consoleMfaConfirmResponseSchema,
  type ConsoleMfaSetup,
  consoleMfaSetupResponseSchema,
} from "@oioi-bwg/contracts/console-mfa";

import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";

/** 현재 사용자의 직렬화된 CASL rules를 조회하고 응답 계약으로 검증한다. */
export async function getCurrentAbility(signal?: AbortSignal) {
  const data = await http.get("/api/auth/ability", { signal });
  return parseClientResponse(serializedAbilityResponseSchema, data);
}

// 인증 입력과 QR은 일회성 폼 메모리에만 둔다. Query/mutation cache에 보관하지 않는다.
export async function setupMfa(input: ConsoleMfaSetup, signal: AbortSignal) {
  return parseClientResponse(
    consoleMfaSetupResponseSchema,
    await http.post("/api/auth/mfa/setup", {
      json: input,
      signal,
      cache: "no-store",
      credentials: "omit",
    }),
  );
}

export async function confirmMfa(input: ConsoleMfaConfirm, signal: AbortSignal) {
  return parseClientResponse(
    consoleMfaConfirmResponseSchema,
    await http.post("/api/auth/mfa/confirm", {
      json: input,
      signal,
      cache: "no-store",
      credentials: "omit",
    }),
  );
}
