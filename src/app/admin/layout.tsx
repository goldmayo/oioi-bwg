import dynamic from "next/dynamic";
import { ReactNode } from "react";

import { createClient } from "@/libs/db/supabase/server";

// LoginForm을 지연 로딩합니다. (zod, react-hook-form 등 무거운 라이브러리 포함)
const LoginForm = dynamic(
  () => import("@/components/admin/LoginForm").then((mod) => mod.LoginForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center p-4">로그인 폼 로딩 중...</div>
    ),
  },
);

// AdminSidebar를 지연 로딩합니다. (곡 목록 데이터 및 UI 로직 포함)
const AdminSidebar = dynamic(
  () => import("@/components/admin/sidebar/AdminSidebar").then((mod) => mod.AdminSidebar),
  {
    ssr: false,
    loading: () => <div className="border-border bg-muted/20 w-64 animate-pulse border-r" />,
  },
);

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 관리자 권한 체크 (role === "admin")
  const isAdmin = user?.app_metadata?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground flex h-screen overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
