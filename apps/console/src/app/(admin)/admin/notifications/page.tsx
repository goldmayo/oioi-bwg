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
    <section className="mx-auto flex h-full min-h-96 w-full max-w-4xl flex-col p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">알림 내역</h1>
      <p className="text-muted-foreground mt-2 mb-6 text-sm leading-6">
        작업 결과와 놓친 알림을 확인합니다.
      </p>
      <div className="bg-card border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
        <NotificationInbox selectedId={parsed.success ? parsed.data : undefined} />
      </div>
    </section>
  );
}
