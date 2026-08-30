import { ReactNode } from "react";
import { forbidden, redirect } from "next/navigation";

import { getRequestContext } from "@/server/auth/request-context";

import AdminSidebar from "./_ui/admin-sidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const context = await getRequestContext();

  if (!context.user) {
    redirect("/admin-login");
  }

  if (context.ability.cannot("manage", "all")) forbidden();

  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden md:flex-row">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
