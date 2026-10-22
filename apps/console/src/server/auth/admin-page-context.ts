import "server-only";

import { AppError } from "@oioi-bwg/server/errors/app-error";
import { forbidden, redirect } from "next/navigation";

import { logAuthRejection } from "@/server/observability/auth-rejection-logger";

import { getRequestAuthorization } from "./request-context";

/** Layout과 병렬 실행되는 관리자 페이지도 서비스 호출 전에 같은 요청의 인증을 확인한다. */
export async function getAdminPageContext() {
  const authorization = await getRequestAuthorization();
  const context = authorization.context;
  if (!context.user) {
    logAuthRejection(authorization, "login_redirect_requested", "admin-rsc");
    redirect("/admin-login");
  }
  if (context.ability.cannot("manage", "all")) {
    logAuthRejection(authorization, "access_denied_requested", "admin-rsc");
    forbidden();
  }
  return context;
}

/** 알려진 인증 실패만 RSC 이동/거부로 번역하고 나머지 예외는 원본 그대로 전달한다. */
export function rethrowAdminPageError(error: unknown): never {
  if (error instanceof AppError) {
    if (error.code === "UNAUTHENTICATED") {
      logAuthRejection(undefined, "login_redirect_requested", "admin-rsc");
      redirect("/admin-login");
    }
    if (error.code === "FORBIDDEN") {
      logAuthRejection(undefined, "access_denied_requested", "admin-rsc");
      forbidden();
    }
  }
  throw error;
}
