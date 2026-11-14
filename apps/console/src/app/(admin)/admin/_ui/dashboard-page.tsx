import { listAdminCheerGuides } from "@oioi-bwg/server/services/cheer-guide-service";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { DashboardAnalytics } from "./dashboard-analytics";
import { DashboardContent, DashboardJobs } from "./dashboard-overview";

export async function DashboardPage({ editing = false }: { editing?: boolean }) {
  const ctx = await getAdminPageContext();
  const guides = await listAdminCheerGuides(ctx).catch(async (error: unknown) =>
    rethrowAdminPageError(error, await getRequestAuthorization()),
  );
  const publishedGuideCount = guides.items.filter(
    ({ currentPublication }) => currentPublication?.action === "PUBLISH",
  ).length;
  return (
    <NuqsAdapter>
      <DashboardAnalytics
        editing={editing}
        accountId={ctx.user!.id}
        content={<DashboardContent publishedGuideCount={publishedGuideCount} />}
        jobs={<DashboardJobs />}
      />
    </NuqsAdapter>
  );
}
