import { redirect } from "next/navigation";

import { LazyLoginForm } from "@/features/auth";

import { auth } from "@/auth";

/**
 * 관리자 전용 로그인 진입점이다. 인증된 사용자는 관리자 화면으로 보낸다.
 */
export default async function AdminLoginPage() {
  const session = await auth();
  if (session?.user) redirect("/admin");

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LazyLoginForm />
      </div>
    </main>
  );
}
