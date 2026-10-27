import { Suspense } from "react";
import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { listAdminSongs } from "@oioi-bwg/server/services/song-service";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { authAbilityQueryKeys } from "@/features/auth";

import { albumQueryKeys } from "@/entities/album";
import { songQueryKeys } from "@/entities/song";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { getQueryClient } from "@/shared/api/query/get-query-client";

import { AdminSongManager } from "./_ui/AdminSongManager";

/**
 * 관리자 곡 관리 페이지
 * SEO 불필요 → dynamic rendering + noindex
 */
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminSongsPage() {
  const context = await getAdminPageContext();
  const [songs, albums] = await Promise.all([
    listAdminSongs(context),
    listAdminAlbums(context),
  ]).catch(async (error: unknown) => rethrowAdminPageError(error, await getRequestAuthorization()));
  const queryClient = getQueryClient();
  queryClient.setQueryData(songQueryKeys.adminList(), songs);
  queryClient.setQueryData(albumQueryKeys.adminList(), albums);
  queryClient.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );

  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">곡 관리</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            곡을 추가, 수정, 삭제할 수 있습니다. 곡 추가 시 LRC 파일이 필요합니다.
          </p>
        </div>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense
            fallback={
              <div className="text-muted-foreground flex h-40 items-center justify-center">
                로딩 중...
              </div>
            }
          >
            <AdminSongManager />
          </Suspense>
        </HydrationBoundary>
      </div>
    </div>
  );
}
