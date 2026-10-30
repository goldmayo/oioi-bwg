import { ReactNode } from "react";

import { getAdminPageContext } from "@/server/auth/admin-page-context";
import { getPushConfig } from "@/server/notifications/config";

import { AdminWorkspace } from "./_ui/admin-sidebar";
import { NotificationProvider } from "./_ui/notification-provider";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getAdminPageContext();

  return (
    <NotificationProvider key={ctx.user!.id} accountId={ctx.user!.id} config={getPushConfig()}>
      <AdminWorkspace>{children}</AdminWorkspace>
    </NotificationProvider>
  );
}
