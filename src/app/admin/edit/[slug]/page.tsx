import { notFound } from "next/navigation";

import { AdminEditorClient } from "@/components/admin/AdminEditorClient";
import { prisma } from "@/libs/prisma";

interface AdminEditPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 관리자 가사 에디터 페이지 (Server Component)
 * 이제 ID가 아닌 고유 Slug를 기반으로 곡 데이터를 로드합니다.
 */
export default async function AdminEditPage({ params }: AdminEditPageProps) {
  const { slug } = await params;

  if (!slug) {
    return notFound();
  }

  // DB에서 곡 데이터 조회 (Slug 기준)
  const song = await prisma.song.findUnique({
    where: { slug },
  });

  if (!song) {
    return notFound();
  }

  return (
    <div className="h-screen overflow-hidden">
      <AdminEditorClient song={song} />
    </div>
  );
}
