import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";

import { getAdminPageContext } from "@/server/auth/admin-page-context";

import { NotificationInbox } from "../_ui/notification-inbox";
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ notificationId?: string }>;
}) {
  await getAdminPageContext();
  const parsed = entityIdSchema.safeParse((await searchParams).notificationId);
  return (
    <section className="mx-auto flex h-full max-w-2xl flex-col p-4 md:p-8">
      <h1 className="mb-4 text-2xl font-semibold">알림</h1>
      <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <NotificationInbox selectedId={parsed.success ? parsed.data : undefined} />
      </div>
    </section>
  );
}
