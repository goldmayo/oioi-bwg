import { ReactNode } from "react";

import { getAdminPageContext } from "@/server/auth/admin-page-context";
import { getPushConfig } from "@/server/notifications/config";

import { NavigationConfirmationProvider } from "@/shared/model/navigation-confirmation";

import { AdminWorkspace } from "./_ui/admin-workspace";
import { NotificationProvider } from "./_ui/notification-provider";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getAdminPageContext();

  return (
    <NavigationConfirmationProvider key={ctx.user!.id}>
      <NotificationProvider accountId={ctx.user!.id} config={getPushConfig()}>
        <AdminWorkspace>{children}</AdminWorkspace>
      </NotificationProvider>
    </NavigationConfirmationProvider>
  );
}
