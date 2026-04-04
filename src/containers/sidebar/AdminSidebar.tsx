import Link from "next/link";

import { getAllAlbumsWithSongs } from "@/shared/api/db/drizzle/queries"; // 쿼리 헬퍼 사용
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";

import { SidebarWrapper } from "./SidebarWrapper";

// 순수 서버 컴포넌트: 데이터 페칭만 담당
export default async function AdminSidebar() {
  // DB에서 앨범과 곡 정보를 모두 포함해서 한 번에 조회합니다.
  const albumsWithSongs = await getAllAlbumsWithSongs();

  const accordionContent = (
    <Accordion type="multiple" className="w-full">
      {albumsWithSongs.map((album) => {
        // 소속된 곡이 없는 앨범은 노출 생략
        if (!album.songs || album.songs.length === 0) return null;

        return (
          <AccordionItem key={album.id} value={album.slug} className="border-border/50">
            <AccordionTrigger className="text-muted-foreground hover:text-foreground py-3 text-left text-xs font-bold tracking-tight hover:no-underline">
              {album.name}
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-1 pb-2">
                {album.songs.map((song) => (
                  <Link
                    key={song.id}
                    prefetch={false}
                    href={`/admin/edit/${song.slug}`}
                    className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2 text-sm font-medium transition-all"
                  >
                    {song.title}
                  </Link>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );

  return <SidebarWrapper>{accordionContent}</SidebarWrapper>;
}
