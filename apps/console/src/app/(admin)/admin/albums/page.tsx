import { Suspense } from "react";
import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";
import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { authAbilityQueryKeys } from "@/features/auth";

import { albumQueryKeys } from "@/entities/album";

import { getAdminPageContext, rethrowAdminPageError } from "@/server/auth/admin-page-context";
import { getRequestAuthorization } from "@/server/auth/request-context";

import { getQueryClient } from "@/shared/api/query/get-query-client";

import { AdminAlbumManager } from "./_ui/AdminAlbumManager";

/**
 * 관리자 앨범 관리 페이지
 * SEO 불필요 → dynamic rendering + noindex
 */
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminAlbumsPage() {
  const context = await getAdminPageContext();
  const albums = await listAdminAlbums(context).catch(async (error: unknown) =>
    rethrowAdminPageError(error, await getRequestAuthorization()),
  );
  const queryClient = getQueryClient();
  queryClient.setQueryData(albumQueryKeys.adminList(), albums);
  queryClient.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );

  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">앨범 관리</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            앨범을 추가, 수정, 삭제할 수 있습니다.
          </p>
        </div>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<div className="text-muted-foreground">앨범을 불러오는 중...</div>}>
            <AdminAlbumManager />
          </Suspense>
        </HydrationBoundary>
      </div>
    </div>
  );
}
