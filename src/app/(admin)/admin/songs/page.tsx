import { Suspense } from "react";

import { SongManagerClient } from "@/features/manage-song";

import { getRequestContext } from "@/server/auth/request-context";
import { listAdminAlbums } from "@/server/services/album-service";
import { listAdminSongs } from "@/server/services/song-service";

import { createSongAction, deleteSongAction, updateSongAction } from "../_lib/song-actions";

/**
 * 관리자 곡 관리 페이지
 * SEO 불필요 → dynamic rendering + noindex
 */
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminSongsPage() {
  const context = await getRequestContext();
  const [songs, albums] = await Promise.all([listAdminSongs(context), listAdminAlbums(context)]);

  return (
    <div className="bg-background min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-foreground text-xl font-bold sm:text-2xl">곡 관리</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            곡을 추가, 수정, 삭제할 수 있습니다. 곡 추가 시 LRC 파일이 필요합니다.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="text-muted-foreground flex h-40 items-center justify-center">
              로딩 중...
            </div>
          }
        >
          <SongManagerClient
            initialSongs={songs}
            albums={albums}
            createSongAction={createSongAction}
            updateSongAction={updateSongAction}
            deleteSongAction={deleteSongAction}
          />
        </Suspense>
      </div>
    </div>
  );
}
