import "server-only";

import {
  type ConsoleMfaConfirm,
  consoleMfaConfirmResponseSchema,
  consoleMfaConfirmSchema,
  type ConsoleMfaSetup,
  consoleMfaSetupResponseSchema,
  consoleMfaSetupSchema,
} from "@oioi-bwg/contracts/console-mfa";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { confirmConsoleMfa, setupConsoleMfa } from "@oioi-bwg/server/services/console-mfa-service";
import QRCode from "qrcode";

import { getConsoleMfaKey } from "@/server/auth/authenticate-console";
import { ConsoleMfaRateLimited, reserveConsoleMfaAttempt } from "@/server/auth/console-mfa-limiter";

import { isConsoleMfaEnrollmentEnabled } from "@/shared/config/console-runtime";

import { jsonResponse, parseJsonRequest, toErrorResponse } from "./api-response";

/** 두 등록 HTTP 경계만 공유한다. 관리 context/JWT를 생성하거나 신뢰하지 않는다. */
export async function handleConsoleMfaEnrollment(request: Request, operation: "setup" | "confirm") {
  let response: Response;
  try {
    const input = await parseJsonRequest<ConsoleMfaSetup | ConsoleMfaConfirm>(
      request,
      operation === "setup" ? consoleMfaSetupSchema : consoleMfaConfirmSchema,
    );
    if (!isConsoleMfaEnrollmentEnabled()) throw new AppError("FORBIDDEN");
    const refund = await reserveConsoleMfaAttempt(input.email);
    const key = getConsoleMfaKey();
    if ("otp" in input) {
      await confirmConsoleMfa(input.email, input.password, input.otp, input.version, key);
      response = jsonResponse(consoleMfaConfirmResponseSchema, { version: input.version });
    } else {
      const pending = await setupConsoleMfa(input.email, input.password, key);
      const issuer = "oioi-bwg Console";
      const uri = new URL(
        `otpauth://totp/${encodeURIComponent(`${issuer}:${input.email.trim().toLowerCase()}`)}`,
      );
      uri.search = new URLSearchParams({
        secret: pending.secret,
        issuer,
        algorithm: "SHA1",
        digits: "6",
        period: "30",
      }).toString();
      const qrDataUrl = await QRCode.toDataURL(uri.href, {
        width: 256,
        margin: 4,
        errorCorrectionLevel: "M",
      });
      response = jsonResponse(consoleMfaSetupResponseSchema, {
        qrDataUrl,
        version: pending.version,
      });
    }
    await refund();
  } catch (error) {
    response = toErrorResponse(
      error instanceof ConsoleMfaRateLimited ? new AppError("OTP_RATE_LIMITED") : error,
    );
    if (error instanceof ConsoleMfaRateLimited)
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
