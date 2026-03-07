import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getAllSongs } from "@/libs/db/drizzle/queries"; // 쿼리 헬퍼 사용
import { ALBUMS } from "@/types/album";

import { SidebarWrapper } from "./SidebarWrapper";

// 순수 서버 컴포넌트: 데이터 페칭만 담당
export async function AdminSidebar() {
  // 직접 db 호출 대신 캡슐화된 쿼리 함수 사용
  const songs = await getAllSongs();

  const albums = songs.reduce(
    (acc, song) => {
      if (!acc[song.albumName]) {
        acc[song.albumName] = [];
      }
      acc[song.albumName].push(song);
      return acc;
    },
    {} as Record<string, typeof songs>,
  );

  const sortedAlbumNames = ALBUMS.map((a) => a.name).filter((name) => !!albums[name]);

  const accordionContent = (
    <Accordion type="multiple" className="w-full">
      {sortedAlbumNames.map((albumName) => (
        <AccordionItem key={albumName} value={albumName} className="border-border/50">
          <AccordionTrigger className="text-muted-foreground hover:text-foreground py-3 text-left text-xs font-bold tracking-tight hover:no-underline">
            {albumName}
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-1 pb-2">
              {albums[albumName].map((song) => (
                <Link
                  key={song.id}
                  href={`/admin/edit/${song.slug}`}
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2 text-sm font-medium transition-all"
                >
                  {song.title}
                </Link>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );

  return <SidebarWrapper>{accordionContent}</SidebarWrapper>;
}
