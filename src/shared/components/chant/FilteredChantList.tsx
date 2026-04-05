"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue } from "react";
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
  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: { query: "" },
  });

  const queryValue = useWatch({ control: form.control, name: "query" });
  const deferredQuery = useDeferredValue(queryValue);

  const filteredSongs =
    deferredQuery.trim() === ""
      ? initialSongs
      : initialSongs.filter(
          (song) =>
            song.title.toLowerCase().includes(deferredQuery.toLowerCase()) ||
            song.albumName.toLowerCase().includes(deferredQuery.toLowerCase()),
        );

  return (
    <>
      {/* 검색 폼 (RHF + Zod + shadcn Form/Input) */}
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
                    className="bg-card hover:bg-accent focus:bg-accent border-border text-foreground placeholder:text-muted-foreground/30 focus:ring-qwer-e/20 h-14 rounded-2xl py-0 pr-6 pl-12 text-base font-bold focus:ring-2"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>

      {/* 검색 결과 카운트 */}
      <p className="text-2xs text-muted-foreground mb-4 px-2 font-bold tabular-nums">
        TOTAL {filteredSongs.length}
      </p>

      {/* 결과 그리드 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song) => (
            <Link
              key={`${song.albumName}-${song.slug}`}
              href={`/songs/${song.slug}`}
              prefetch={false}
              className="group border-border bg-card hover:bg-accent flex w-full items-center justify-between rounded-2xl border p-4 transition-all duration-300"
            >
              <div className="flex min-w-0 items-center gap-4">
                {/* 앨범 커버 썸네일 */}
                <div className="bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={song.albumCover}
                    alt={song.albumName}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="60px"
                  />
                </div>

                {/* 정보 영역 */}
                <div className="flex min-w-0 flex-col gap-0.5">
                  {/* {song.hasOfficial && (
                    <div className="mb-1">
                      <OfficialBadge />
                    </div>
                  )} */}
                  <h3 className="text-foreground group-hover:text-primary line-clamp-1 text-sm font-black transition-colors">
                    {song.title}
                  </h3>
                  <p className="text-muted-foreground line-clamp-1 text-xs font-semibold">
                    {song.albumName}
                  </p>
                </div>
              </div>

              {/* 연습하기 버튼 */}
              <div className="group/btn border-border/40 hover:border-primary/40 bg-background hover:bg-primary/5 ml-2 flex shrink-0 items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all active:scale-95">
                <span className="text-muted-foreground group-hover/btn:text-primary transition-colors">
                  연습하기
                </span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </Link>
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
