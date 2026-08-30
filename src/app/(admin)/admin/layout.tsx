import { ReactNode } from "react";
import { forbidden } from "next/navigation";

import { LazyLoginForm } from "@/features/auth";

import { getRequestContext } from "@/server/auth/request-context";

import AdminSidebar from "./_ui/admin-sidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const context = await getRequestContext();

  if (!context.user) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <LazyLoginForm />
        </div>
      </div>
    );
  }

  if (context.ability.cannot("manage", "all")) forbidden();

  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden md:flex-row">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
