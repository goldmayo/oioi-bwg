import { cache } from "react";

import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import { findAuthorizationFactsByAccountId } from "../repositories/auth-repository";

import { type AppAbility, type AuthorizationFacts, buildAbility } from "./ability";

import { auth } from "@/auth";

export type AuthenticatedRequestContext = {
  user: { id: string };
  ability: AppAbility;
};

export type GuestRequestContext = {
  user: null;
  ability: AppAbility;
};

export type RequestContext = AuthenticatedRequestContext | GuestRequestContext;

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

export const getRequestContext = cache(loadRequestContext);

export function requireUser(ctx: RequestContext): asserts ctx is AuthenticatedRequestContext {
  if (!ctx.user) {
    throw new AppError("UNAUTHENTICATED");
  }
}
