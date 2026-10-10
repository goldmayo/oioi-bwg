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
import { findConsoleAuthorizationFacts } from "@oioi-bwg/server/repositories/admin-mfa-repository";

import { hasConsoleMfaProof } from "./console-session";

import { auth } from "@/auth";

function guestContext(): GuestRequestContext {
  return { user: null, ability: buildAbility({ accountId: null, role: null }) };
}

function toAccountId(value: string) {
  if (!/^[1-9]\d{0,18}$/.test(value)) return null;
  try {
    const id = BigInt(value);
    return id <= 9_223_372_036_854_775_807n ? id : null;
  } catch {
    return null;
  }
}

async function loadRequestContext(): Promise<RequestContext> {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId || !hasConsoleMfaProof(session?.user)) return guestContext();

  const accountId = toAccountId(sessionUserId);
  if (accountId === null) return guestContext();

  const account = await findConsoleAuthorizationFacts(getDatabase(), accountId);
  if (
    !account ||
    account.status !== "ACTIVE" ||
    account.role !== "ADMIN" ||
    account.enabledAt === null ||
    account.version !== session.user.mfaVersion
  )
    return guestContext();

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
