import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { prisma } from "@/libs/prisma";
import { ALBUMS } from "@/types/album"; // 통합 상수 사용

import { SidebarWrapper } from "./SidebarWrapper";

// 순수 서버 컴포넌트: 데이터 페칭만 담당
export async function AdminSidebar() {
  const songs = await prisma.song.findMany({
    orderBy: { order: "asc" },
  });

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

  // ALBUMS 상수에 정의된 순서 그대로 정렬
  const sortedAlbumNames = ALBUMS.map((a) => a.name).filter((name) => !!albums[name]);

  const accordionContent = (
    <Accordion type="multiple" className="w-full">
      {sortedAlbumNames.map((albumName) => (
        <AccordionItem key={albumName} value={albumName} className="border-border/50">
          <AccordionTrigger className="py-3 text-left text-xs font-bold tracking-tight text-muted-foreground hover:text-foreground hover:no-underline">
            {albumName}
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-1 pb-2">
              {albums[albumName].map((song) => (
                <Link
                  key={song.id}
                  href={`/admin/edit/${song.slug}`}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
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

  return (
    // 클라이언트 컴포넌트 래퍼에게 서버 컴포넌트 결과를 children으로 넘김 (Server Components Composition)
    <SidebarWrapper>
      {accordionContent}
    </SidebarWrapper>
  );
}
