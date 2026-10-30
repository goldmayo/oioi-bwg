import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import type {
  OperatorDeviceGrant,
  OperatorExchangeResult,
} from "@oioi-bwg/contracts/operator-auth";
import { buildAbility } from "../auth/ability";
import { requireUser, type RequestContext } from "../auth/request-context";
import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import { findConsoleAuthorizationFacts } from "../repositories/admin-mfa-repository";
import {
  OperatorSessionConflictError,
  approveOperatorSession,
  exchangeOperatorSession,
  findOperatorSessionByDevice,
  findOperatorSessionByToken,
  insertOperatorSession,
  purgeOperatorSessions,
  revokeOperatorSession,
} from "../repositories/operator-session-repository";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const invalid = () => new AppError("UNAUTHENTICATED");

async function currentAccount(accountId: string, mfaVersion: number) {
  const facts = await findConsoleAuthorizationFacts(getDatabase(), accountId);
  if (
    !facts ||
    facts.status !== "ACTIVE" ||
    facts.role !== "ADMIN" ||
    !facts.enabledAt ||
    facts.version !== mfaVersion
  )
    throw invalid();
  return facts;
}

/** HTTP adapter가 기본 비활성·Origin/빈도 제한을 검사한 뒤 호출한다. */
export async function createOperatorGrant(now = new Date()): Promise<OperatorDeviceGrant> {
  const db = getDatabase();
  await purgeOperatorSessions(db, new Date(now.getTime() - 86400000).toISOString());
  for (let attempt = 0; attempt < 3; attempt++) {
    const deviceCode = randomBytes(32).toString("hex");
    const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
    const userCode = `${code.slice(0, 4)}-${code.slice(4)}`;
    const expiresAt = new Date(now.getTime() + 600000).toISOString();
    try {
      await insertOperatorSession(db, {
        deviceHash: hash(deviceCode),
        userCodeHash: hash(userCode),
        createdAt: now.toISOString(),
        expiresAt,
      });
      return { deviceCode, userCode, expiresAt, intervalSeconds: 5 };
    } catch (error) {
      if (!(error instanceof OperatorSessionConflictError)) throw error;
    }
  }
  throw new Error("Operator grant allocation failed");
}

/** 기대 MFA version은 브라우저 인증 guard의 증명이며 client body에서 받지 않는다. */
export async function approveOperatorGrant(
  ctx: RequestContext,
  expectedMfaVersion: number,
  userCode: string,
  now = new Date(),
) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  await currentAccount(ctx.user.id, expectedMfaVersion);
  const row = await approveOperatorSession(
    getDatabase(),
    hash(userCode),
    {
      accountId: ctx.user.id,
      mfaVersion: expectedMfaVersion,
    },
    now.toISOString(),
  );
  if (!row) throw invalid();
  return { approved: true as const };
}

export async function exchangeOperatorGrant(
  deviceCode: string,
  now = new Date(),
): Promise<OperatorExchangeResult> {
  const db = getDatabase();
  const row = await findOperatorSessionByDevice(db, hash(deviceCode));
  if (!row || Date.parse(row.expiresAt) <= now.getTime() || row.exchangedAt || row.revokedAt)
    throw invalid();
  if (!row.accountId || !row.mfaVersion) return { status: "pending" };
  await currentAccount(row.accountId, row.mfaVersion);
  const accessToken = `oioi_${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(now.getTime() + 28800000).toISOString();
  const claimed = await exchangeOperatorSession(
    db,
    hash(deviceCode),
    {
      tokenHash: hash(accessToken),
      tokenExpiresAt: expiresAt,
    },
    now.toISOString(),
  );
  if (!claimed) throw invalid();
  return { status: "authorized", accessToken, expiresAt };
}

/** 제한된 operator HTTP 진입점만 사용한다. 일반 관리 cookie/Runner 인증으로 대체하지 않는다. */
export async function authorizeOperatorToken(accessToken: string, now = new Date()) {
  if (!/^oioi_[a-f0-9]{64}$/.test(accessToken)) throw invalid();
  const row = await findOperatorSessionByToken(getDatabase(), hash(accessToken), now.toISOString());
  if (!row?.accountId || !row.mfaVersion || !row.tokenExpiresAt) throw invalid();
  const facts = await currentAccount(row.accountId, row.mfaVersion);
  const context: RequestContext = {
    user: { id: facts.id },
    ability: buildAbility({ accountId: facts.id, role: facts.role }),
  };
  return { context, accountId: facts.id, expiresAt: new Date(row.tokenExpiresAt).toISOString() };
}

export async function revokeOperatorToken(accessToken: string, now = new Date()) {
  await authorizeOperatorToken(accessToken, now);
  await revokeOperatorSession(getDatabase(), hash(accessToken), now.toISOString());
  return { revoked: true as const };
}
