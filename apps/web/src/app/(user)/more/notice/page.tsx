import { listPublicNotices } from "@oioi-bwg/server/services/publication-service";
import { Circle } from "lucide-react";

import { constructMetadata } from "@/shared/lib/metadata";

import { MoreDocumentFrame } from "../_ui/more-document-frame";

export const dynamic = "force-dynamic";

export const metadata = constructMetadata({
  title: "공지사항",
  path: "/more/notice",
  description: "어이어이바위게의 서비스 소식과 점검 안내입니다.",
});

export default async function NoticesPage() {
  const notices = await listPublicNotices();
  return (
    <MoreDocumentFrame title="공지사항" href="/more/notice">
      <div className="space-y-12 md:space-y-16">
        {notices.length === 0 && (
          <p className="text-muted-foreground py-8 leading-relaxed">
            아직 등록된 공지사항이 없어요.
          </p>
        )}
        {notices.map((notice) => (
          <article
            key={notice.id}
            aria-labelledby={`notice-${notice.id}`}
            className="border-border border-b pb-12 md:pb-16"
          >
            <div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-3 text-sm md:text-base">
              <span className="text-foreground dark:text-qwer-w inline-flex items-center gap-2 font-semibold">
                <Circle aria-hidden="true" className="size-2.5 fill-current" />
                {notice.category}
              </span>
              <span aria-hidden="true" className="text-border">
                |
              </span>
              <time dateTime={notice.publishedOn} className="tabular-nums">
                {notice.publishedOn.replaceAll("-", ".")}
              </time>
            </div>
            <h2
              id={`notice-${notice.id}`}
              className="text-foreground mb-8 text-2xl leading-snug font-bold text-balance break-keep md:mb-10 md:text-3xl"
            >
              {notice.title}
            </h2>
            <p className="text-foreground/90 max-w-prose text-base leading-loose break-keep whitespace-pre-line md:text-lg">
              {notice.content}
            </p>
          </article>
        ))}
      </div>
    </MoreDocumentFrame>
  );
}
