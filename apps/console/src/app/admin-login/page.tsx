import { redirect } from "next/navigation";

import { LazyLoginForm } from "@/features/auth";

import { getRequestContext } from "@/server/auth/request-context";

import { isConsoleMfaEnrollmentEnabled } from "@/shared/config/console-runtime";

/**
 * 관리자 전용 로그인 진입점이다. 인증된 사용자는 관리자 화면으로 보낸다.
 */
export default async function AdminLoginPage() {
  const context = await getRequestContext();
  if (context.user) redirect("/admin");

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LazyLoginForm enrollmentEnabled={isConsoleMfaEnrollmentEnabled()} />
      </div>
    </main>
  );
}
