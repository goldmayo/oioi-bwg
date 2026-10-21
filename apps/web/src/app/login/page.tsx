import { redirect } from "next/navigation";

import { LazyLoginForm } from "./_ui/LazyLoginForm";

import { auth } from "@/auth";

/**
 * 기존 사용자의 일반 로그인 진입점이다. 인증된 사용자는 홈으로 보낸다.
 */
export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LazyLoginForm />
      </div>
    </main>
  );
}
