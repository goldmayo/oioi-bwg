import { ReactNode } from "react";

import { getAdminPageContext } from "@/server/auth/admin-page-context";

import AdminSidebar from "./_ui/admin-sidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await getAdminPageContext();

  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden md:flex-row">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
