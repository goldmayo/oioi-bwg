import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { listAdminSongs } from "@oioi-bwg/server/services/song-service";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { DashboardAnalytics } from "./_ui/dashboard-analytics";
import { DashboardOverview } from "./_ui/dashboard-overview";

export default async function AdminPage() {
  const ctx = await getAdminPageContext();
  const [albums, songs] = await Promise.all([listAdminAlbums(ctx), listAdminSongs(ctx)]).catch(
    async (error: unknown) => rethrowAdminPageError(error, await getRequestAuthorization()),
  );
  return (
    <>
      <DashboardOverview
        albumCount={albums.items.length}
        songCount={songs.items.length}
        visibleSongCount={songs.items.filter((song) => song.isVisible).length}
      />
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <NuqsAdapter>
          <DashboardAnalytics accountId={ctx.user!.id} />
        </NuqsAdapter>
      </div>
    </>
  );
}
