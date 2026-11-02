import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { getAdminSongInformation } from "@oioi-bwg/server/services/song-service";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { authAbilityQueryKeys } from "@/features/auth";

import { albumQueryKeys } from "@/entities/album";
import { songQueryKeys } from "@/entities/song";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { getQueryClient } from "@/shared/api/query/get-query-client";

import { AdminSongScreen } from "./AdminSongScreen";

export async function SongScreenServer({
  id,
  mode,
}: {
  id?: string;
  mode: "view" | "edit" | "create";
}) {
  const context = await getAdminPageContext();
  if (id && !entityIdSchema.safeParse(id).success) notFound();
  const [albums, song] = await Promise.all([
    listAdminAlbums(context),
    id ? getAdminSongInformation(context, id) : Promise.resolve(null),
  ]).catch(async (error: unknown) => {
    if (error instanceof AppError && error.code === "SONG_NOT_FOUND") notFound();
    return rethrowAdminPageError(error, await getRequestAuthorization());
  });
  const client = getQueryClient();
  client.setQueryData(albumQueryKeys.adminList(), albums);
  if (song) client.setQueryData(songQueryKeys.adminInformation(song.id), song);
  client.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );
  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-7xl">
        <HydrationBoundary state={dehydrate(client)}>
          <AdminSongScreen id={id} mode={mode} />
        </HydrationBoundary>
      </div>
    </div>
  );
}
