"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import gsap from "gsap";
import { ChevronRight, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { AlbumSong } from "@/shared/types/album";
import { Form, FormControl, FormField, FormItem } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";

// ----------------------------------------------------------------------
// 1. 검색 스키마
// ----------------------------------------------------------------------
const searchSchema = z.object({
  query: z.string(),
});

type SearchFormValues = z.infer<typeof searchSchema>;

// ----------------------------------------------------------------------
// 2. Props
// ----------------------------------------------------------------------
interface FilteredChantListProps {
  initialSongs: (AlbumSong & { albumName: string; albumCover: string })[];
}

// ----------------------------------------------------------------------
// 3. 컴포넌트
// ----------------------------------------------------------------------
export function FilteredChantList({ initialSongs }: FilteredChantListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: { query: "" },
  });

  const queryValue = useWatch({ control: form.control, name: "query" });
  const deferredQuery = useDeferredValue(queryValue);

  // 필터링 로직
  const filteredSongs =
    deferredQuery.trim() === ""
      ? initialSongs
      : initialSongs.filter(
          (song) =>
            song.title.toLowerCase().includes(deferredQuery.toLowerCase()) ||
            song.albumName.toLowerCase().includes(deferredQuery.toLowerCase()),
        );

  /**
   * [ANIMATION] 검색 결과 변경 시 애니메이션 연출
   * - 초기 진입 시: blur(10px) (메인 화면 동기화)
   * - 검색 필터링 시: blur(4px) (사용자 피로도 감소)
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const items = containerRef.current.querySelectorAll(".chant-item-wrapper");
    if (items.length === 0) return;

    // 현재 검색어 유무에 따른 블러 강도 조절
    const isSearching = deferredQuery.trim() !== "";
    const blurAmount = isSearching ? "1px" : "2px";

    gsap.fromTo(
      items,
      { opacity: 0, y: 15, filter: `blur(${blurAmount})` },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        stagger: 0.03,
        duration: 0.6,
        ease: "power2.out",
        overwrite: true,
      },
    );
  }, [filteredSongs.length, deferredQuery]); // 결과 개수가 바뀌거나 검색어가 확정(Deferred)될 때만 실행

  return (
    <>
      {/* 검색 폼 */}
      <Form {...form}>
        <form className="relative mb-12 px-2" onSubmit={(e) => e.preventDefault()}>
          <FormField
            control={form.control}
            name="query"
            render={({ field }) => (
              <FormItem className="relative">
                <Search
                  size={20}
                  className="text-muted-foreground/40 group-focus-within:text-qwer-e absolute top-1/2 left-4 -translate-y-1/2 transition-colors"
                />
                <FormControl>
                  <Input
                    {...field}
                    placeholder="곡명 또는 앨범명으로 찾아보세요"
                    autoComplete="off"
                    className="bg-card hover:bg-accent focus:bg-accent border-border text-foreground placeholder:text-muted-foreground/30 focus:ring-qwer-e/20 h-14 rounded-2xl py-0 pr-6 pl-12 text-base font-bold transition-all focus:ring-2"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>

      {/* 결과 그리드 */}
      <div
        ref={containerRef}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4"
      >
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song) => (
            <div
              key={`${song.albumName}-${song.slug}`}
              className="chant-item-wrapper opacity-0" // GSAP 초기 타겟용
            >
              <Link
                href={`/songs/${song.slug}`}
                prefetch={false}
                className="group border-border bg-card hover:bg-accent flex w-full items-center justify-between rounded-2xl border p-4 transition-all duration-300"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={song.albumCover}
                      alt={song.albumName}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="60px"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="text-foreground group-hover:text-primary line-clamp-1 text-sm font-black transition-colors">
                      {song.title}
                    </h3>
                    <p className="text-muted-foreground line-clamp-1 text-xs font-semibold">
                      {song.albumName}
                    </p>
                  </div>
                </div>
                <div className="group/btn border-border/40 hover:border-primary/40 bg-background hover:bg-primary/5 ml-2 flex shrink-0 items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all active:scale-95">
                  <span className="text-muted-foreground group-hover/btn:text-primary transition-colors">
                    연습하기
                  </span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              </Link>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-20 text-center opacity-40">
            <Search size={48} className="text-muted-foreground mb-4" />
            <p className="text-lg font-bold">검색 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </>
  );
}
