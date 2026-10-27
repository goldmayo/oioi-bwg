import "server-only";
import { requireUser, type RequestContext } from "../auth/request-context";
import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import { lockConsoleAuthenticationFacts } from "../repositories/admin-mfa-repository";
import {
  bindPushInstallation,
  disablePushInstallation,
} from "../repositories/push-installation-repository";

export async function registerPushInstallation(
  ctx: RequestContext,
  fid: string,
  proof: { mfaVersion: number; expiresAt: string },
) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  const expiry = Math.min(new Date(proof.expiresAt).getTime(), Date.now() + 8 * 3600_000);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new AppError("UNAUTHENTICATED");
  return getDatabase().transaction(async (tx) => {
    const current = await lockConsoleAuthenticationFacts(tx, ctx.user.id);
    if (
      current.account?.status !== "ACTIVE" ||
      current.account.role !== "ADMIN" ||
      !current.mfa?.enabledAt ||
      current.mfa.version !== proof.mfaVersion
    )
      throw new AppError("UNAUTHENTICATED");
    const row = await bindPushInstallation(tx, {
      fid,
      accountId: ctx.user.id,
      mfaVersion: proof.mfaVersion,
      expiresAt: new Date(expiry).toISOString(),
    });
    return { id: row.id };
  });
}
export async function unregisterPushInstallation(ctx: RequestContext, id: string) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  await disablePushInstallation(getDatabase(), ctx.user.id, id);
}
/** Auth.js가 검증한 logout token의 subject에 속한 브라우저 연결만 해제한다. */
export async function releasePushInstallation(accountId: string, id: string) {
  await disablePushInstallation(getDatabase(), accountId, id);
}
