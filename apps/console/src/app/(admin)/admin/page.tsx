import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { listAdminSongs } from "@oioi-bwg/server/services/song-service";
import Link from "next/link";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { adminPaths } from "@/shared/config/admin-routes";
import { Button } from "@/shared/ui/button";

import { DashboardAnalytics } from "./_ui/dashboard-analytics";
import { DashboardContent, DashboardJobs } from "./_ui/dashboard-overview";
import { DashboardWidgets } from "./_ui/dashboard-widgets";

export default async function AdminPage() {
  const ctx = await getAdminPageContext();
  const [albums, songs] = await Promise.all([listAdminAlbums(ctx), listAdminSongs(ctx)]).catch(
    async (error: unknown) => rethrowAdminPageError(error, await getRequestAuthorization()),
  );
  return (
    <section className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            콘텐츠를 관리하고 작업 결과를 확인합니다.
          </p>
        </div>
        <Button variant="outline" className="h-11 md:h-9" asChild>
          <Link href={adminPaths.dashboardSettings}>대시보드 관리</Link>
        </Button>
      </header>
      <DashboardWidgets
        accountId={ctx.user!.id}
        content={
          <DashboardContent
            albumCount={albums.items.length}
            songCount={songs.items.length}
            visibleSongCount={songs.items.filter((song) => song.isVisible).length}
          />
        }
        jobs={<DashboardJobs />}
        analytics={
          <NuqsAdapter>
            <DashboardAnalytics accountId={ctx.user!.id} />
          </NuqsAdapter>
        }
      />
    </section>
  );
}
