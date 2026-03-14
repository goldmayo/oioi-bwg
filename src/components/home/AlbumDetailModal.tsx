"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

// import { OfficialBadge } from "@/components/common/OfficialBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Album } from "@/types/album";
import { analytics } from "@/utils/analytics";

interface AlbumDetailModalProps {
  album: Album;
  onClose?: () => void;
}

export function AlbumDetailModal({ album, onClose }: AlbumDetailModalProps) {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  /**
   * 모달 진입 애니메이션
   */
  useGSAP(() => {
    if (modalRef.current && backdropRef.current) {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none" });

      gsap.fromTo(
        modalRef.current,
        { scale: 0.99 },
        { scale: 1, duration: 0.5, ease: "back.out(1.2)" },
      );
    }
  }, []);

  /**
   * 닫기 애니메이션 수행 후 부모의 onClose 호출 혹은 홈으로 이동
   */
  const handleClose = () => {
    if (!modalRef.current || !backdropRef.current) return;

    const tl = gsap.timeline({
      onComplete: () => {
        if (onClose) {
          onClose();
        } else {
          router.replace("/", { scroll: false });
        }
      },
    });

    tl.to(modalRef.current, {
      scale: 0.99,
      opacity: 0,
      duration: 0.4,
      ease: "power2.out",
    }).to(
      backdropRef.current,
      {
        opacity: 0,
        duration: 0.4,
        ease: "power2.out",
      },
      "<",
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4 md:p-10">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="bg-background/80 absolute inset-0 backdrop-blur-xl"
        onClick={handleClose}
      />

      {/* Modal Content Container */}
      <div className="pointer-events-none relative flex h-full max-h-[85vh] w-full max-w-5xl items-center justify-center">
        <div
          ref={modalRef}
          className="bg-card border-border pointer-events-auto relative flex h-full w-full flex-col overflow-hidden rounded-2xl border shadow-2xl md:flex-row"
        >
          {/* 좌측: 앨범 커버 */}
          <div className="border-border/50 relative h-[35vh] w-full shrink-0 overflow-hidden border-b md:h-full md:w-[45%] md:border-r md:border-b-0">
            <Image
              src={`/images/albums/${album.imageSlug}.webp`}
              alt={album.name}
              fill
              sizes="(max-width: 768px) 100vw, 45vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent md:bg-linear-to-r md:from-transparent md:to-black/20" />

            <div className="border-border/10 absolute right-8 bottom-8 left-8 z-10 mb-4 border-b pb-4 text-left md:hidden">
              <Badge
                style={{ backgroundColor: album.color }}
                className="mb-3 rounded-full border-none px-3 py-0.5 font-black text-white"
              >
                {album.name.split(":")[0]}
              </Badge>
              <h2 className="text-3xl leading-tight font-black tracking-tighter text-white">
                {album.name.includes(":") ? album.name.split(":")[1].trim() : album.name}
              </h2>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="absolute top-8 left-8 z-20 h-12 w-12 rounded-full border border-white/10 bg-black/20 text-white backdrop-blur-xl hover:bg-black/40"
              onClick={handleClose}
            >
              <X size={24} />
            </Button>
          </div>

          {/* 우측: 수록곡 리스트 */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="bg-card/90 sticky top-0 z-10 hidden px-16 pt-16 pb-8 text-left backdrop-blur-md md:block">
              <Badge
                style={{ backgroundColor: album.color }}
                className="mb-6 rounded-full border-none px-4 py-1 font-black text-white shadow-sm"
              >
                {album.name.split(":")[0]}
              </Badge>
              <h2 className="text-foreground mb-4 text-4xl leading-tight font-black tracking-tighter lg:text-6xl">
                {album.name.includes(":") ? album.name.split(":")[1].trim() : album.name}
              </h2>
              <div className="h-1.5 w-24 rounded-full" style={{ backgroundColor: album.color }} />
            </header>

            <div className="flex-1 overflow-y-auto px-8 pt-8 pb-16 md:px-16 md:pt-0">
              <div className="mx-auto grid max-w-xl gap-3 md:mx-0">
                {album.songs.map((song, idx) => (
                  <Link
                    key={song.title}
                    href={`/songs/${song.slug}`}
                    prefetch={false}
                    onClick={() => analytics.trackSongClick(song.title, album.name)}
                    className="song-item border-border/30 bg-background/50 hover:bg-accent flex items-center justify-between rounded-2xl border p-5 transition-all duration-300"
                  >
                    <div className="flex items-center gap-6">
                      <span className="text-muted-foreground font-mono text-sm font-bold opacity-40">
                        {(idx + 1).toString().padStart(2, "0")}
                      </span>
                      <h4 className="group-hover:text-qwer-w text-left text-xl font-bold tracking-tight transition-colors">
                        {song.title}
                      </h4>
                    </div>
                    {/* {song.hasOfficial && <OfficialBadge type={"e"} />} */}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
