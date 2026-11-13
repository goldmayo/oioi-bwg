import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { listAdminSongs } from "@oioi-bwg/server/services/song-service";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { DashboardAnalytics } from "./dashboard-analytics";
import { DashboardContent, DashboardJobs } from "./dashboard-overview";

export async function DashboardPage({ editing = false }: { editing?: boolean }) {
  const ctx = await getAdminPageContext();
  const [albums, songs] = await Promise.all([listAdminAlbums(ctx), listAdminSongs(ctx)]).catch(
    async (error: unknown) => rethrowAdminPageError(error, await getRequestAuthorization()),
  );
  return (
    <NuqsAdapter>
      <DashboardAnalytics
        editing={editing}
        accountId={ctx.user!.id}
        content={
          <DashboardContent
            albumCount={albums.items.length}
            songCount={songs.items.length}
            visibleSongCount={songs.items.filter((song) => song.isVisible).length}
          />
        }
        jobs={<DashboardJobs />}
      />
    </NuqsAdapter>
  );
}
