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

export type AuthorizationDecision =
  | "no_valid_identity"
  | "mfa_proof_missing"
  | "invalid_identity"
  | "authorization_facts_missing"
  | "account_inactive"
  | "admin_role_required"
  | "mfa_disabled"
  | "mfa_version_mismatch"
  | "authorized"
  | "unknown";

export interface RequestAuthorization {
  context: RequestContext;
  decision: AuthorizationDecision;
  rejectionLogged: boolean;
}

function guestAuthorization(decision: AuthorizationDecision): RequestAuthorization {
  return { context: guestContext(), decision, rejectionLogged: false };
}

async function loadRequestAuthorization(): Promise<RequestAuthorization> {
  const session = await auth();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) return guestAuthorization("no_valid_identity");
  if (!hasConsoleMfaProof(session?.user)) return guestAuthorization("mfa_proof_missing");

  const accountId = toAccountId(sessionUserId);
  if (accountId === null) return guestAuthorization("invalid_identity");

  const account = await findConsoleAuthorizationFacts(getDatabase(), accountId);
  if (!account) return guestAuthorization("authorization_facts_missing");
  if (account.status !== "ACTIVE") return guestAuthorization("account_inactive");
  if (account.role !== "ADMIN") return guestAuthorization("admin_role_required");
  if (account.enabledAt === null) return guestAuthorization("mfa_disabled");
  if (account.version !== session.user.mfaVersion)
    return guestAuthorization("mfa_version_mismatch");

  const facts: AuthorizationFacts = {
    accountId: account.id.toString(),
    role: account.role,
  };

  return {
    context: { user: { id: account.id.toString() }, ability: buildAbility(facts) },
    decision: "authorized",
    rejectionLogged: false,
  };
}

/** 현재 요청의 활성 Account와 CASL ability를 반환한다. 인증되지 않은 요청도 guest context로 표현한다. */
export const getRequestAuthorization = cache(loadRequestAuthorization);

export async function getRequestContext(): Promise<RequestContext> {
  return (await getRequestAuthorization()).context;
}
