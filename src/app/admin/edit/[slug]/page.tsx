import { notFound } from "next/navigation";

import { LazyAdminEditor } from "@/components/admin/LazyAdminEditor";
import { getSongBySlug } from "@/libs/db/drizzle/queries";

interface AdminEditPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 관리자 가사 에디터 페이지 (Server Component)
 * 데이터 접근 계층(Queries)을 활용하여 곡 데이터를 로드합니다.
 */
export default async function AdminEditPage({ params }: AdminEditPageProps) {
  const { slug } = await params;

  if (!slug) {
    return notFound();
  }

  // 캡슐화된 쿼리 함수 사용
  const song = await getSongBySlug(slug);

  if (!song) {
    return notFound();
  }

  return (
    <div className="h-screen overflow-hidden">
      <LazyAdminEditor song={song} />
    </div>
  );
}
