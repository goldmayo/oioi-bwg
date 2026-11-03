import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { getAdminPageContext } from "@/server/auth/admin-page-context";

import { NotificationHistory } from "./_ui/NotificationHistory";
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ notificationId?: string }>;
}) {
  await getAdminPageContext();
  const parsed = entityIdSchema.safeParse((await searchParams).notificationId);
  return (
    <NuqsAdapter>
      <NotificationHistory selectedId={parsed.success ? parsed.data : undefined} />
    </NuqsAdapter>
  );
}
