import "server-only";

import { cache } from "react";
import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import type { GuestRequestContext, RequestContext } from "@oioi-bwg/server/auth/request-context";

import { getRequestObservation } from "@/server/observability/request-observation";

import type { RequestObservation } from "@/shared/lib/observability-correlation";
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
  const result = entityIdSchema.safeParse(value);
  return result.success ? result.data : null;
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
  observation?: RequestObservation;
}

function guestAuthorization(
  decision: AuthorizationDecision,
  observation: RequestObservation,
): RequestAuthorization {
  return { context: guestContext(), decision, rejectionLogged: false, observation };
}

async function loadRequestAuthorization(): Promise<RequestAuthorization> {
  const observation = await getRequestObservation();
  const session = await auth();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) return guestAuthorization("no_valid_identity", observation);
  if (!hasConsoleMfaProof(session?.user))
    return guestAuthorization("mfa_proof_missing", observation);

  const accountId = toAccountId(sessionUserId);
  if (accountId === null) return guestAuthorization("invalid_identity", observation);

  const account = await findConsoleAuthorizationFacts(getDatabase(), accountId);
  if (!account) return guestAuthorization("authorization_facts_missing", observation);
  if (account.status !== "ACTIVE") return guestAuthorization("account_inactive", observation);
  if (account.role !== "ADMIN") return guestAuthorization("admin_role_required", observation);
  if (account.enabledAt === null) return guestAuthorization("mfa_disabled", observation);
  if (account.version !== session.user.mfaVersion)
    return guestAuthorization("mfa_version_mismatch", observation);

  const facts: AuthorizationFacts = {
    accountId: account.id.toString(),
    role: account.role,
  };

  return {
    context: { user: { id: account.id.toString() }, ability: buildAbility(facts) },
    observation,
    decision: "authorized",
    rejectionLogged: false,
  };
}

/** 현재 요청의 활성 Account와 CASL ability를 반환한다. 인증되지 않은 요청도 guest context로 표현한다. */
export const getRequestAuthorization = cache(loadRequestAuthorization);

export async function getRequestContext(): Promise<RequestContext> {
  return (await getRequestAuthorization()).context;
}
