"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

import { OfficialBadge } from "@/components/common/OfficialBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Album } from "@/types/album";

interface AlbumDetailModalProps {
  album: Album;
  onClose: () => void;
}

export function AlbumDetailModal({ album, onClose }: AlbumDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  /**
   * 모달 진입 애니메이션 (Zoom & Fade)
   */
  useGSAP(() => {
    if (modalRef.current && backdropRef.current) {
      gsap.fromTo(backdropRef.current, 
        { opacity: 0 }, 
        { opacity: 1, duration: 0.3, ease: "none" }
      );

      gsap.fromTo(modalRef.current, 
        { scale: 0.95, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.2)" }
      );

      gsap.fromTo(".song-item", 
        { y: 10, opacity: 0 }, 
        { y: 0, opacity: 1, stagger: 0.03, duration: 0.4, delay: 0.2, ease: "power2.out" }
      );
    }
  }, []);

  /**
   * 닫기 애니메이션 수행 후 부모의 onClose 호출
   */
  const handleClose = () => {
    if (!modalRef.current || !backdropRef.current) return;

    const tl = gsap.timeline({
      onComplete: onClose
    });

    tl.to(modalRef.current, {
      scale: 0.98,
      opacity: 0,
      duration: 0.4,
      ease: "power2.out"
    }).to(backdropRef.current, {
      opacity: 0,
      duration: 0.4,
      ease: "power2.out"
    }, "<");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 overflow-hidden">
      {/* Backdrop */}
      <div 
        ref={backdropRef}
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
        onClick={handleClose}
      />
      
      {/* Modal Content Container */}
      <div className="relative w-full max-w-5xl h-full max-h-[85vh] pointer-events-none flex items-center justify-center">
        <div 
          ref={modalRef}
          className="relative w-full h-full bg-card border border-border shadow-2xl rounded-[3rem] overflow-hidden flex flex-col md:flex-row pointer-events-auto"
        >
          {/* 좌측: 앨범 커버 */}
          <div className="relative w-full h-[35vh] md:h-full md:w-[45%] overflow-hidden shrink-0 border-b md:border-b-0 md:border-r border-border/50">
            <Image
              src={`/images/albums/${album.imageSlug}.webp`}
              alt={album.name}
              fill
              className="object-cover"
            />
            {/* [고도화] 모바일 전용 제목 오버레이 레이어 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/20" />
            
            {/* 모바일에서만 보이는 제목 정보 (Header Overlay) */}
            <div className="absolute bottom-8 left-8 right-8 z-10 md:hidden">
              <Badge style={{ backgroundColor: album.color }} className="text-white font-black px-3 py-0.5 mb-3 border-none rounded-full">
                {album.name.split(":")[0]}
              </Badge>
              <h2 className="text-3xl font-black tracking-tighter text-white leading-tight">
                {album.name.includes(":") ? album.name.split(":")[1].trim() : album.name}
              </h2>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="absolute top-8 left-8 text-white bg-black/20 backdrop-blur-xl hover:bg-black/40 rounded-full h-12 w-12 border border-white/10 z-20"
              onClick={handleClose}
            >
              <X size={24} />
            </Button>
          </div>

          {/* 우측: 수록곡 리스트 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* [고도화] 데스크탑 전용 스티키 헤더 */}
            <header className="sticky top-0 z-10 hidden md:block px-16 pt-16 pb-8 bg-card/90 backdrop-blur-md">
              <Badge style={{ backgroundColor: album.color }} className="text-white font-black px-4 py-1 mb-6 rounded-full border-none shadow-sm">
                {album.name.split(":")[0]}
              </Badge>
              <h2 className="text-4xl lg:text-6xl font-black tracking-tighter text-foreground mb-4 leading-tight">
                {album.name.includes(":") ? album.name.split(":")[1].trim() : album.name}
              </h2>
              <div className="h-1.5 w-24 rounded-full" style={{ backgroundColor: album.color }} />
            </header>

            {/* 수록곡 목록 */}
            <div className="flex-1 overflow-y-auto px-8 md:px-16 pb-16 pt-8 md:pt-0 custom-scrollbar ios-touch">
              <div className="grid gap-3 max-w-xl mx-auto md:mx-0">
                {album.songs.map((song, idx) => (
                  <Link 
                    key={song.title} 
                    href={`/songs/${song.slug}`}
                    className="song-item flex items-center justify-between p-5 rounded-2xl border border-border/30 bg-background/50 hover:bg-accent transition-all duration-300"
                  >
                    <div className="flex items-center gap-6">
                      <span className="font-mono text-muted-foreground text-sm font-bold opacity-40">{(idx + 1).toString().padStart(2, '0')}</span>
                      <h4 className="text-xl font-bold tracking-tight group-hover:text-qwer-w transition-colors">
                        {song.title}
                      </h4>
                    </div>
                    {song.hasOfficial && <OfficialBadge />}
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
