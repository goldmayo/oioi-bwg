import { ReactNode } from "react";

import { LazyLoginForm } from "@/features/auth/LazyLoginForm";

import { createClient } from "@/shared/api/db/supabase/server";

import AdminSidebar from "@/containers/sidebar/AdminSidebar";

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
          <LazyLoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden md:flex-row">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
