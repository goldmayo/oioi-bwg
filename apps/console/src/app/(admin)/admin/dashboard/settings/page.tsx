import { getAdminPageContext } from "@/server/auth/admin-page-context";

import { DashboardLayoutSettings } from "./_ui/dashboard-layout-settings";

export default async function DashboardSettingsPage() {
  const context = await getAdminPageContext();
  return <DashboardLayoutSettings accountId={context.user!.id} />;
}
