import { ReactNode } from "react";

import { LoginForm } from "@/components/admin/LoginForm";
import { AdminSidebar } from "@/components/admin/sidebar/AdminSidebar";
import { checkServerAdmin } from "@/libs/db/supabase/server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = await checkServerAdmin();

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
