"use client";

import type { ReactNode } from "react";

import { AdminLocationProvider, useAdminNavigation } from "../_model/admin-location";

import { AdminBreadcrumbs } from "./admin-breadcrumbs";
import { AdminLogoutAction } from "./admin-logout-action";
import { AdminShell } from "./admin-shell";
import AdminSidebar from "./admin-sidebar";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";

function Workspace({ children }: { children: ReactNode }) {
  const { breadcrumbs, section } = useAdminNavigation();
  return (
    <AdminShell
      navigation={<AdminSidebar activeHref={section?.href} />}
      breadcrumbs={<AdminBreadcrumbs items={breadcrumbs} />}
      headerActions={
        <>
          <ThemeToggle />
          <NotificationBell />
        </>
      }
      sidebarFooter={<AdminLogoutAction />}
    >
      {children}
    </AdminShell>
  );
}

export function AdminWorkspace({ children }: { children: ReactNode }) {
  return (
    <AdminLocationProvider>
      <Workspace>{children}</Workspace>
    </AdminLocationProvider>
  );
}
