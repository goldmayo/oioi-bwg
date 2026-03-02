import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { prisma } from "@/libs/prisma";

import { SidebarWrapper } from "./SidebarWrapper";

const ALBUM_ORDER = [
  "1st Single Album: Harmony from Discord",
  "1st Mini Album: MANITO",
  "2nd Mini Album: Algorithm's Blossom",
  "3rd Mini Album: In a million noises, I'll be your harmony",
  "Digital Single: Youth Promise",
  "Singles",
];

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

  const sortedAlbumNames = Object.keys(albums).sort((a, b) => {
    const indexA = ALBUM_ORDER.indexOf(a);
    const indexB = ALBUM_ORDER.indexOf(b);

    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;

    return indexA - indexB;
  });

  const accordionContent = (
    <Accordion type="multiple" className="w-full">
      {sortedAlbumNames.map((albumName) => (
        <AccordionItem key={albumName} value={albumName} className="border-zinc-800">
          <AccordionTrigger className="text-left text-sm font-semibold text-zinc-300 hover:text-zinc-100 hover:no-underline">
            {albumName}
          </AccordionTrigger>
          <AccordionContent>
            <div className="mt-2 flex flex-col gap-1">
              {albums[albumName].map((song) => (
                <Link
                  key={song.id}
                  href={`/admin/edit/${song.id}`}
                  className="rounded-md px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
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
