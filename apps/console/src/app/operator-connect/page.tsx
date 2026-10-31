import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { getRequestAuthorization } from "@/server/auth/request-context";

import { isConsoleOperatorEnabled } from "@/shared/config/console-runtime";

import { OperatorConnectForm } from "./_ui/operator-connect-form";

export default async function OperatorConnectPage() {
  // 기본 비활성 빌드의 404를 정적으로 고정하지 않고 요청 시점의 설정을 평가한다.
  await connection();
  if (!isConsoleOperatorEnabled()) notFound();
  const auth = await getRequestAuthorization();
  if (!auth.context.user || !auth.mfaVersion) redirect("/admin-login?next=operator");
  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <OperatorConnectForm />
    </main>
  );
}
