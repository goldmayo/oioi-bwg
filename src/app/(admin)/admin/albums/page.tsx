import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { authAbilityQueryKeys } from "@/features/auth";

import { albumQueryKeys } from "@/entities/album";

import { getRequestContext } from "@/server/auth/request-context";
import { listAdminAlbums } from "@/server/services/album-service";

import { getQueryClient } from "@/shared/api/query/get-query-client";
import { serializedAbilityResponseSchema } from "@/shared/contracts/authorization";

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
  const context = await getRequestContext();
  const albums = await listAdminAlbums(context);
  const queryClient = getQueryClient();
  queryClient.setQueryData(albumQueryKeys.adminList(), albums);
  queryClient.setQueryData(
    authAbilityQueryKeys.ability(),
    serializedAbilityResponseSchema.parse({ rules: context.ability.rules }),
  );

  return (
    <div className="bg-background min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-foreground text-xl font-bold sm:text-2xl">앨범 관리</h1>
          <p className="text-muted-foreground mt-1 text-sm">
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
