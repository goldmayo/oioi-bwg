"use client";

import type { ReactNode } from "react";

import { AdminLocationProvider, useAdminNavigation } from "../_model/admin-location";

import { AdminShell } from "./admin-shell";
import AdminSidebar from "./admin-sidebar";

function Workspace({ children }: { children: ReactNode }) {
  const { breadcrumbs, section } = useAdminNavigation();
  return (
    <AdminShell breadcrumbs={breadcrumbs} navigation={<AdminSidebar activeHref={section?.href} />}>
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
