import { Suspense } from "react";

import { AlbumManagerClient } from "@/features/manage-content/ui/AlbumManagerClient";
import { getAllAlbums } from "@/shared/api/db/drizzle/queries";

/**
 * 관리자 앨범 관리 페이지
 * SEO 불필요 → dynamic rendering + noindex
 */
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminAlbumsPage() {
  const albums = await getAllAlbums();

  return (
    <div className="bg-background min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-foreground text-xl font-bold sm:text-2xl">앨범 관리</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            앨범을 추가, 수정, 삭제할 수 있습니다.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="text-muted-foreground flex h-40 items-center justify-center">
              로딩 중...
            </div>
          }
        >
          <AlbumManagerClient initialAlbums={albums} />
        </Suspense>
      </div>
    </div>
  );
}
