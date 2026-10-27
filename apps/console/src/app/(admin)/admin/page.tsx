import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { listAdminSongs } from "@oioi-bwg/server/services/song-service";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { DashboardOverview } from "./_ui/dashboard-overview";

export default async function AdminPage() {
  const ctx = await getAdminPageContext();
  const [albums, songs] = await Promise.all([listAdminAlbums(ctx), listAdminSongs(ctx)]).catch(
    async (error: unknown) => rethrowAdminPageError(error, await getRequestAuthorization()),
  );
  return (
    <DashboardOverview
      albumCount={albums.items.length}
      songCount={songs.items.length}
      visibleSongCount={songs.items.filter((song) => song.isVisible).length}
    />
  );
}
