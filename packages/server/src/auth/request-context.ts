import "server-only";

import { AppError } from "../errors/app-error";
import type { AppAbility } from "./ability";

export type AuthenticatedRequestContext = {
  user: { id: string };
  ability: AppAbility;
};

export type GuestRequestContext = {
  user: null;
  ability: AppAbility;
};

export type RequestContext = AuthenticatedRequestContext | GuestRequestContext;

/** 인증이 필요한 service 경계에서 guest context를 거부한다. */
export function requireUser(ctx: RequestContext): asserts ctx is AuthenticatedRequestContext {
  if (!ctx.user) {
    throw new AppError("UNAUTHENTICATED");
  }
}
