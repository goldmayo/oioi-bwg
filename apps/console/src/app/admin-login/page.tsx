import { redirect } from "next/navigation";

import { LazyLoginForm } from "@/features/auth";

import { getRequestContext } from "@/server/auth/request-context";

import {
  isConsoleMfaEnrollmentEnabled,
  isConsoleOperatorEnabled,
} from "@/shared/config/console-runtime";

/**
 * 관리자 전용 로그인 진입점이다. 인증 후 관리 화면 또는 고정된 CLI 승인 화면으로 보낸다.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[]; next?: string | string[] }>;
}) {
  const { code, next } = await searchParams;
  const destination = next === "operator" && isConsoleOperatorEnabled() ? "operator" : "admin";
  const context = await getRequestContext();
  if (context.user) redirect(destination === "operator" ? "/operator-connect" : "/admin");

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LazyLoginForm
          enrollmentEnabled={isConsoleMfaEnrollmentEnabled()}
          initialRateLimited={code === "rate_limited"}
          destination={destination}
        />
      </div>
    </main>
  );
}
