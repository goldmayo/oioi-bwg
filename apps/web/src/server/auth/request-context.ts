import "server-only";

import { cache } from "react";
import type { GuestRequestContext, RequestContext } from "@oioi-bwg/server/auth/request-context";
export type {
  AuthenticatedRequestContext,
  GuestRequestContext,
  RequestContext,
} from "@oioi-bwg/server/auth/request-context";
export { requireUser } from "@oioi-bwg/server/auth/request-context";

import { type AuthorizationFacts, buildAbility } from "@oioi-bwg/server/auth/ability";
import { getDatabase } from "@oioi-bwg/server/db";
import { findAuthorizationFactsByAccountId } from "@oioi-bwg/server/repositories/auth-repository";

import { auth } from "@/auth";

function guestContext(): GuestRequestContext {
  return { user: null, ability: buildAbility({ accountId: null, role: null }) };
}

function toAccountId(value: string) {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

async function loadRequestContext(): Promise<RequestContext> {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) return guestContext();

  const accountId = toAccountId(sessionUserId);
  if (accountId === null) return guestContext();

  const account = await findAuthorizationFactsByAccountId(getDatabase(), accountId);
  if (!account || account.status !== "ACTIVE") return guestContext();

  const facts: AuthorizationFacts = {
    accountId: account.id.toString(),
    role: account.role,
  };

  return {
    user: { id: account.id.toString() },
    ability: buildAbility(facts),
  };
}

/** 현재 요청의 활성 Account와 CASL ability를 반환한다. 인증되지 않은 요청도 guest context로 표현한다. */
export const getRequestContext = cache(loadRequestContext);
