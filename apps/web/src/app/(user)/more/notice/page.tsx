import { listPublicNotices } from "@oioi-bwg/server/services/publication-service";

import { constructMetadata } from "@/shared/lib/metadata";

import { MoreBackButton, MoreHeader } from "../_ui/more-common";

import { NoticeAccordion } from "./_ui/notice-accordion";

export const dynamic = "force-dynamic";

export const metadata = constructMetadata({
  title: "공지사항",
  path: "/more/notice",
  description: "어이어이바위게의 서비스 소식과 점검 안내입니다.",
});

export default async function NoticesPage() {
  const notices = await listPublicNotices();
  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      <MoreBackButton />

      <MoreHeader title="공지사항" subTitle="Notices" className="mt-12" />

      {/* 공지사항 목록 (Client Accordion inside Server Page) */}
      <div className="flex flex-col gap-4">
        {notices.length === 0 && (
          <p className="text-muted-foreground">아직 등록된 공지사항이 없어요.</p>
        )}
        {notices.map((notice) => (
          <NoticeAccordion key={notice.id} notice={{ ...notice, date: notice.publishedOn }} />
        ))}
      </div>
    </div>
  );
}
