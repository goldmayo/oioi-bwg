import Image from "next/image";
import Link from "next/link";

import { Album } from "@/shared/types/album";
import { analytics } from "@/shared/utils/analytics";

interface AlbumCardProps {
  album: Album;
}

/**
 * 앨범 그리드 아이템 컴포넌트
 * (향후 리스트 형태 등 디자인 교체 시 이 컴포넌트만 변경하면 됩니다)
 */
export function AlbumCard({ album }: AlbumCardProps) {
  return (
    <Link
      href={`/albums/${album.imageSlug}`}
      scroll={false}
      prefetch={false}
      onClick={() => analytics.trackAlbumClick(album.name, album.imageSlug)}
      className="group bg-card border-border/50 hover:border-border relative aspect-square cursor-pointer overflow-hidden rounded-2xl border transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
    >
      <div className="relative h-full w-full">
        <Image
          src={album.imgUrl}
          alt={album.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          loading="eager"
          className="object-cover transition-transform duration-1000 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-80" />
        <div className="absolute right-8 bottom-10 left-8 text-left text-white">
          <h3 className="text-2xl leading-none font-black tracking-tighter drop-shadow-2xl">
            {album.name.split(":")[0]}
          </h3>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1 w-6 rounded-full" style={{ backgroundColor: album.color }} />
            <p className="text-[10px] font-bold tracking-widest text-white/60 uppercase">
              {album.songs.length} Tracks
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
