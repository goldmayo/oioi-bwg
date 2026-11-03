import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { authAbilityQueryKeys } from "@/features/auth";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { getQueryClient } from "@/shared/api/query/get-query-client";

import { AdminPageLocation } from "../../_model/admin-location";

import { AdminAlbumScreen } from "./AdminAlbumScreen";

export async function AlbumScreenServer({ id }: { id?: string }) {
  const context = await getAdminPageContext();
  if (id && !entityIdSchema.safeParse(id).success) notFound();
  const albums = id
    ? await listAdminAlbums(context).catch(async (error: unknown) =>
        rethrowAdminPageError(error, await getRequestAuthorization()),
      )
    : null;
  const album = albums?.items.find((item) => item.id === id);
  if (id && !album) notFound();
  const client = getQueryClient();
  client.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );
  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-3xl">
        <AdminPageLocation title={album ? `${album.name} · 앨범 정보 수정` : "앨범 추가"} />
        <HydrationBoundary state={dehydrate(client)}>
          <AdminAlbumScreen album={album} />
        </HydrationBoundary>
      </div>
    </div>
  );
}
