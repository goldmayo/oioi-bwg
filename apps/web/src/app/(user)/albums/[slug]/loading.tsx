import { AlbumDetailSkeleton } from "./_ui/album-detail-skeleton";

export default function AlbumDetailLoading() {
  return (
    <main className="bg-background flex flex-col px-4 pt-10 md:px-10">
      <div className="mx-auto flex h-[85vh] w-full max-w-5xl animate-pulse items-center justify-center">
        <AlbumDetailSkeleton />
      </div>
    </main>
  );
}
